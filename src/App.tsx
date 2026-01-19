import { Workbench } from "./layout/workbench"
import { TopBar } from "./components/TopBar/TopBar"
import { TreeView } from "./components/Tree/TreeView"
import { EditorView } from "./components/Editor/EditorView"

import { useWorkspaceController } from "./hooks/useWorkspaceController"
import { useEditorController } from "./hooks/useEditorController"

export default function App() {
  const {
    workspace,
    workspaceRoot,
    changeWorkspace,
    openNode,
  } = useWorkspaceController()

  const {
    activeFile,
    activeFilePath,
    fileContent,
    openFile,
    onChange,
  } = useEditorController(workspaceRoot)

  return (
    <Workbench
      // TopBar implementation
      top={
        <TopBar
          workspaceRoot={workspaceRoot}
          onChangeWorkspace={changeWorkspace}
        />
      }

      // Left Panel rendering
      left={
        <TreeView
          tree={workspace.tree}
          activeNodeId={workspace.session?.active_node}
          onOpen={(node) => {
            openNode(node)
            openFile(node)
          }}
        />
      }

      main={
        <div style={{ padding: 16, height: "100%" }}>
          {activeFile && activeFilePath ? (
            <>
              <h3>{activeFile.name}</h3>
              <EditorView
                path={activeFilePath}
                content={fileContent}
                onChange={onChange}
              />
            </>
          ) : (
            <p>Select a file from the tree.</p>
          )}
        </div>
      }
      bottom={<div style={{ padding: 8 }}>Status / Logs</div>}
    />
  )
}
