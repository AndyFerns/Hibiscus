import * as monaco from 'monaco-editor';
import { scanMarkdownLine } from './markdownLineLexer';
import type { MarkdownToken } from './markdownLineLexer';

// Re-export for consumers that import from this module
export { scanMarkdownLine };
export type { MarkdownToken };

export interface MarkdownInlineDecoratorOptions {
  onNavigateLink?: (url: string) => void;
  onNavigateWikiLink?: (page: string) => void;
}

interface FenceRange {
  startLine: number;
  endLine: number;
  type: 'code' | 'frontmatter';
}

/**
 * High-performance inline Markdown live preview decorator engine.
 */
export class MarkdownInlineDecorator {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private options: MarkdownInlineDecoratorOptions;
  
  private decorationsCollection: monaco.editor.IEditorDecorationsCollection;
  private disposables: monaco.IDisposable[] = [];
  /**
   * Token cache keyed by line *content*, not line number, so inserting or
   * deleting lines never invalidates it (identical lines also share work).
   */
  private lineCache = new Map<string, MarkdownToken[]>();
  private activeLines = new Set<number>();
  private fenceRanges: FenceRange[] = [];
  
  private isComposing = false;
  private isEnabled = true;
  private updatePending = false;

  constructor(editor: monaco.editor.IStandaloneCodeEditor, options?: MarkdownInlineDecoratorOptions) {
    this.editor = editor;
    this.options = options || {};
    this.decorationsCollection = this.editor.createDecorationsCollection();

    this.registerListeners();
    this.registerCommands();
    
    // Initial scan and render
    this.refreshFences();
    this.updateActiveLines();
    this.scheduleUpdate();
  }

  /**
   * Enable or disable the decorator engine (e.g. for source mode).
   */
  public setEnabled(enabled: boolean): void {
    if (this.isEnabled !== enabled) {
      this.isEnabled = enabled;
      if (!this.isEnabled) {
        this.decorationsCollection.clear();
      } else {
        this.refresh();
      }
    }
  }

  /**
   * Force a full refresh of decorations (e.g., on theme change).
   */
  public refresh(): void {
    // The token cache is keyed by line content, so it never goes stale.
    this.refreshFences();
    this.updateActiveLines();
    this.scheduleUpdate();
  }

  /**
   * Cleans up all event listeners and decorations.
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.decorationsCollection.clear();
  }

  private static readonly LINE_CACHE_LIMIT = 4000;

  private registerListeners() {
    this.disposables.push(
      this.editor.onDidChangeModelContent((e) => {
        if (!this.isEnabled) return;
        if (this.fenceAffectedBy(e.changes)) {
          this.refreshFences();
        } else {
          this.shiftFences(e.changes[0]);
        }
        this.scheduleUpdate();
      })
    );

    // A different file was attached to the editor (tab switch).
    this.disposables.push(
      this.editor.onDidChangeModel(() => {
        if (!this.isEnabled) return;
        this.refreshFences();
        this.updateActiveLines();
        this.scheduleUpdate();
      })
    );

    this.disposables.push(
      this.editor.onDidChangeCursorPosition(() => {
        this.updateActiveLines();
        this.scheduleUpdate();
      })
    );

    this.disposables.push(
      this.editor.onDidChangeCursorSelection(() => {
        this.updateActiveLines();
        this.scheduleUpdate();
      })
    );
    
    this.disposables.push(
      this.editor.onDidScrollChange(() => {
        this.scheduleUpdate();
      })
    );

    const domNode = this.editor.getDomNode();
    if (domNode) {
      const onCompositionStart = () => {
        this.isComposing = true;
      };
      const onCompositionEnd = () => {
        this.isComposing = false;
        this.scheduleUpdate();
      };
      
      domNode.addEventListener('compositionstart', onCompositionStart);
      domNode.addEventListener('compositionend', onCompositionEnd);
      
      this.disposables.push({
        dispose: () => {
          domNode.removeEventListener('compositionstart', onCompositionStart);
          domNode.removeEventListener('compositionend', onCompositionEnd);
        }
      });
    }

    this.disposables.push(
      this.editor.onMouseDown((e) => this.handleMouseDown(e))
    );
  }

  private registerCommands() {
    this.disposables.push(
      this.editor.addAction({
        id: 'markdown.toggleCheckbox',
        label: 'Toggle Checkbox',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => this.toggleCheckboxCommand()
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'markdown.jumpNextHeading',
        label: 'Jump to Next Heading',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketRight],
        run: () => this.jumpHeadingCommand(1)
      })
    );

    this.disposables.push(
      this.editor.addAction({
        id: 'markdown.jumpPrevHeading',
        label: 'Jump to Previous Heading',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.BracketLeft],
        run: () => this.jumpHeadingCommand(-1)
      })
    );
  }

  private updateActiveLines() {
    const selections = this.editor.getSelections() || [];
    this.activeLines.clear();
    for (const sel of selections) {
      for (let i = sel.startLineNumber; i <= sel.endLineNumber; i++) {
        this.activeLines.add(i);
      }
    }
  }

  private refreshFences() {
    const model = this.editor.getModel();
    if (!model) return;
    
    this.fenceRanges = [];
    const lineCount = model.getLineCount();
    let inFence = false;
    let fenceStart = 0;
    
    for (let i = 1; i <= lineCount; i++) {
      const line = model.getLineContent(i);
      
      // Frontmatter
      if (i === 1 && (line.startsWith('---') || line.startsWith('+++'))) {
        inFence = true;
        fenceStart = 1;
        continue;
      }
      if (inFence && fenceStart === 1 && (line.startsWith('---') || line.startsWith('+++'))) {
        this.fenceRanges.push({ startLine: fenceStart, endLine: i, type: 'frontmatter' });
        inFence = false;
        continue;
      }
      
      // Code blocks
      if (line.trim().startsWith('```')) {
        if (inFence && fenceStart !== 1) {
          this.fenceRanges.push({ startLine: fenceStart, endLine: i, type: 'code' });
          inFence = false;
        } else if (!inFence) {
          inFence = true;
          fenceStart = i;
        }
      }
    }
    
    // Unclosed fence to EOF
    if (inFence) {
       this.fenceRanges.push({ startLine: fenceStart, endLine: lineCount, type: fenceStart === 1 ? 'frontmatter' : 'code' });
    }
  }
  
  /**
   * Decide whether an edit could have created, removed or moved a fence
   * boundary. Only then is a full O(lines) rescan needed; ordinary typing just
   * shifts the existing ranges.
   */
  private fenceAffectedBy(changes: monaco.editor.IModelContentChange[]): boolean {
    if (changes.length !== 1) return true;
    const c = changes[0];
    const start = c.range.startLineNumber;
    const end = c.range.endLineNumber;
    if (start <= 2) return true; // frontmatter lives at the top
    if (c.text.includes('`')) return true;
    for (const f of this.fenceRanges) {
      if (f.startLine > end) break;
      if ((f.startLine >= start && f.startLine <= end) || (f.endLine >= start && f.endLine <= end)) {
        return true;
      }
    }
    // An edit can turn an ordinary line into a fence (e.g. deleting "a" from "a```").
    const model = this.editor.getModel();
    if (model && start <= model.getLineCount() && model.getLineContent(start).trim().startsWith('```')) {
      return true;
    }
    return false;
  }

  /** Move fence ranges below an edit by the number of lines it added/removed. */
  private shiftFences(change: monaco.editor.IModelContentChange | undefined) {
    if (!change) return;
    let added = 0;
    for (let i = 0; i < change.text.length; i++) if (change.text.charCodeAt(i) === 10) added++;
    const removed = change.range.endLineNumber - change.range.startLineNumber;
    const delta = added - removed;
    if (delta === 0) return;
    const at = change.range.startLineNumber;
    for (const f of this.fenceRanges) {
      if (f.startLine > at) {
        f.startLine += delta;
        f.endLine += delta;
      } else if (f.endLine >= at) {
        f.endLine += delta;
      }
    }
  }

  /** Binary search over the sorted, non-overlapping fence ranges. */
  private isLineInFence(lineNumber: number): boolean {
    const ranges = this.fenceRanges;
    let lo = 0;
    let hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = ranges[mid];
      if (lineNumber < r.startLine) hi = mid - 1;
      else if (lineNumber > r.endLine) lo = mid + 1;
      else return true;
    }
    return false;
  }

  private scheduleUpdate() {
    if (this.updatePending || this.isComposing || !this.isEnabled) return;
    this.updatePending = true;
    requestAnimationFrame(() => {
      this.updatePending = false;
      this.applyDecorations();
    });
  }

  private applyDecorations() {
    if (!this.isEnabled) return;
    const model = this.editor.getModel();
    if (!model) return;

    const visibleRanges = this.editor.getVisibleRanges();
    if (visibleRanges.length === 0) return;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    const minLine = Math.max(1, visibleRanges[0].startLineNumber - 20);
    const maxLine = Math.min(model.getLineCount(), visibleRanges[visibleRanges.length - 1].endLineNumber + 20);

    for (let i = minLine; i <= maxLine; i++) {
      if (this.isLineInFence(i)) continue;
      
      const lineContent = model.getLineContent(i);
      
      let tokens = this.lineCache.get(lineContent);
      if (!tokens) {
        tokens = this.scanLine(lineContent);
        if (this.lineCache.size >= MarkdownInlineDecorator.LINE_CACHE_LIMIT) {
          this.lineCache.clear();
        }
        this.lineCache.set(lineContent, tokens);
      }

      const isActive = this.activeLines.has(i);

      for (const token of tokens) {
        let inlineClassName = '';
        
        switch (token.type) {
          case 'heading': inlineClassName = `md-h${token.level}`; break;
          case 'bold': inlineClassName = 'md-bold'; break;
          case 'italic': inlineClassName = 'md-italic'; break;
          case 'strikethrough': inlineClassName = 'md-strikethrough'; break;
          case 'code': inlineClassName = 'md-code-inline'; break;
          case 'blockquote': inlineClassName = 'md-blockquote'; break;
          case 'task-checked': inlineClassName = 'md-task-checked'; break;
          case 'link': inlineClassName = 'md-link'; break;
          case 'wikilink': inlineClassName = 'md-wikilink'; break;
          case 'hr': inlineClassName = 'md-hr'; break;
        }

        if (inlineClassName) {
          newDecorations.push({
            range: new monaco.Range(i, token.startColumn, i, token.endColumn),
            options: {
              inlineClassName,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
          });
        }

        if (!isActive && token.syntaxRanges.length > 0) {
          for (const syntaxRange of token.syntaxRanges) {
            newDecorations.push({
              range: new monaco.Range(i, syntaxRange.startColumn, i, syntaxRange.endColumn),
              options: {
                inlineClassName: 'md-syntax-hidden',
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
              }
            });
          }
        }
      }
    }

    this.decorationsCollection.set(newDecorations);
  }

  private scanLine(line: string): MarkdownToken[] {
    return scanMarkdownLine(line);
  }

  private toggleCheckboxCommand() {
    const model = this.editor.getModel();
    if (!model) return;
    const pos = this.editor.getPosition();
    if (!pos) return;

    const line = model.getLineContent(pos.lineNumber);
    const taskMatch = line.match(/^(\s*[-*+]\s+\[)( |x|X)(\])/);
    
    // If it's a task list item
    if (taskMatch) {
      const isChecked = taskMatch[2] !== ' ';
      const newChar = isChecked ? ' ' : 'x';
      const col = taskMatch[1].length + 1;
      
      this.editor.executeEdits('markdown-inline', [{
        range: new monaco.Range(pos.lineNumber, col, pos.lineNumber, col + 1),
        text: newChar,
        forceMoveMarkers: true
      }]);
    } else {
      // If it's a link line, we can also trigger link navigation on ctrl+enter as per specs
      const tokens = this.scanLine(line);
      const link = tokens.find(t => t.type === 'link' || t.type === 'wikilink');
      if (link) {
        if (link.type === 'link' && this.options.onNavigateLink && link.url) {
          this.options.onNavigateLink(link.url);
        } else if (link.type === 'wikilink' && this.options.onNavigateWikiLink && link.page) {
          this.options.onNavigateWikiLink(link.page);
        }
      }
    }
  }

  private jumpHeadingCommand(direction: 1 | -1) {
    const model = this.editor.getModel();
    if (!model) return;
    const pos = this.editor.getPosition();
    if (!pos) return;

    const currentLine = pos.lineNumber;
    const lineCount = model.getLineCount();
    
    let targetLine = -1;
    
    if (direction === 1) {
      for (let i = currentLine + 1; i <= lineCount; i++) {
        if (model.getLineContent(i).match(/^(#{1,6})\s/) && !this.isLineInFence(i)) {
          targetLine = i;
          break;
        }
      }
    } else {
      for (let i = currentLine - 1; i >= 1; i--) {
        if (model.getLineContent(i).match(/^(#{1,6})\s/) && !this.isLineInFence(i)) {
          targetLine = i;
          break;
        }
      }
    }

    if (targetLine !== -1) {
      this.editor.setPosition({ lineNumber: targetLine, column: 1 });
      this.editor.revealLineInCenter(targetLine);
    }
  }

  private handleMouseDown(e: monaco.editor.IEditorMouseEvent) {
    if (!e.target.position) return;
    
    const pos = e.target.position;
    const model = this.editor.getModel();
    if (!model) return;

    const line = model.getLineContent(pos.lineNumber);
    
    // Check if clicked on a task checkbox
    const taskMatch = line.match(/^(\s*[-*+]\s+)\[( |x|X)\]/);
    if (taskMatch) {
      const checkboxStart = taskMatch[1].length + 1;
      const checkboxEnd = checkboxStart + 3; // `[ ]`
      
      if (pos.column >= checkboxStart && pos.column <= checkboxEnd) {
        this.editor.setPosition(pos); // Move cursor first
        this.toggleCheckboxCommand();
        return;
      }
    }
    
    // Check if Ctrl+Click on a link
    if (e.event.ctrlKey || e.event.metaKey) {
      const tokens = this.scanLine(line);
      const clickedLink = tokens.find(t => 
        (t.type === 'link' || t.type === 'wikilink') && 
        pos.column >= t.startColumn && 
        pos.column <= t.endColumn
      );
      
      if (clickedLink) {
        if (clickedLink.type === 'link' && this.options.onNavigateLink && clickedLink.url) {
          this.options.onNavigateLink(clickedLink.url);
        } else if (clickedLink.type === 'wikilink' && this.options.onNavigateWikiLink && clickedLink.page) {
          this.options.onNavigateWikiLink(clickedLink.page);
        }
      }
    }
  }
}
