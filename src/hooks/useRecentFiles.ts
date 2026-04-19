/**
 * ============================================================================  
 * useRecentFiles Hook
 * ============================================================================
 * 
 * Manages recent files and folders for the File menu.
 * Persists to localStorage for quick access across sessions.
 * 
 * FEATURES:
 * - Track recent files and folders separately
 * - Limit to configurable number of items (default: 10)
 * - Add new items, remove old ones
 * - Clear all recent items
 * - Persist to localStorage automatically
 * ============================================================================
 */

import { useState, useEffect } from "react"

const RECENT_FILES_KEY = "hibiscus:recentFiles"
const RECENT_FOLDERS_KEY = "hibiscus:recentFolders"
const MAX_RECENT_ITEMS = 10

export interface RecentItem {
  path: string
  name: string
  timestamp: number
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentItem[]>([])
  const [recentFolders, setRecentFolders] = useState<RecentItem[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const filesJson = localStorage.getItem(RECENT_FILES_KEY)
      const foldersJson = localStorage.getItem(RECENT_FOLDERS_KEY)
      
      if (filesJson) {
        const files = JSON.parse(filesJson)
        setRecentFiles(Array.isArray(files) ? files : [])
      }
      
      if (foldersJson) {
        const folders = JSON.parse(foldersJson)
        setRecentFolders(Array.isArray(folders) ? folders : [])
      }
    } catch (error) {
      console.error("[Hibiscus] Failed to load recent files:", error)
    }
  }, [])

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentFiles))
    } catch (error) {
      console.error("[Hibiscus] Failed to save recent files:", error)
    }
  }, [recentFiles])

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(recentFolders))
    } catch (error) {
      console.error("[Hibiscus] Failed to save recent folders:", error)
    }
  }, [recentFolders])

  /**
   * Add a file to recent files list
   */
  const addRecentFile = (path: string) => {
    const name = path.split(/[/\\]/).pop() || path
    const newItem: RecentItem = { path, name, timestamp: Date.now() }
    
    setRecentFiles(prev => {
      // Remove existing entry with same path
      const filtered = prev.filter(item => item.path !== path)
      // Add new item at the beginning
      const updated = [newItem, ...filtered]
      // Limit to max items
      return updated.slice(0, MAX_RECENT_ITEMS)
    })
  }

  /**
   * Add a folder to recent folders list
   */
  const addRecentFolder = (path: string) => {
    const name = path.split(/[/\\]/).pop() || path
    const newItem: RecentItem = { path, name, timestamp: Date.now() }
    
    setRecentFolders(prev => {
      // Remove existing entry with same path
      const filtered = prev.filter(item => item.path !== path)
      // Add new item at the beginning
      const updated = [newItem, ...filtered]
      // Limit to max items
      return updated.slice(0, MAX_RECENT_ITEMS)
    })
  }

  /**
   * Remove a specific recent file
   */
  const removeRecentFile = (path: string) => {
    setRecentFiles(prev => prev.filter(item => item.path !== path))
  }

  /**
   * Remove a specific recent folder
   */
  const removeRecentFolder = (path: string) => {
    setRecentFolders(prev => prev.filter(item => item.path !== path))
  }

  /**
   * Clear all recent files
   */
  const clearRecentFiles = () => {
    setRecentFiles([])
  }

  /**
   * Clear all recent folders
   */
  const clearRecentFolders = () => {
    setRecentFolders([])
  }

  /**
   * Clear all recent items (files and folders)
   */
  const clearAll = () => {
    clearRecentFiles()
    clearRecentFolders()
  }

  return {
    recentFiles,
    recentFolders,
    addRecentFile,
    addRecentFolder,
    removeRecentFile,
    removeRecentFolder,
    clearRecentFiles,
    clearRecentFolders,
    clearAll,
  }
}
