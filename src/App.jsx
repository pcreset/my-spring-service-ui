import React, { useState, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import './App.css'

const API_BASE = 'http://localhost:8080/api/v1'

function App() {
  const [filename, setFilename] = useState('')
  const [rowData, setRowData] = useState([])
  const [colDefs, setColDefs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rowCount, setRowCount] = useState(null)

  const loadFile = useCallback(async () => {
    if (!filename.trim()) {
      setError('Please enter a filename.')
      return
    }

    setLoading(true)
    setError('')
    setRowData([])
    setColDefs([])
    setRowCount(null)

    try {
      const response = await fetch(
        `${API_BASE}/data/load?file=${encodeURIComponent(filename.trim())}`
      )
      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.message || 'Failed to load file.')
        return
      }

      const rows = json.data
      if (!rows || rows.length === 0) {
        setError('File loaded but contains no data.')
        return
      }

      // Auto-generate column definitions from first row keys
      const columns = Object.keys(rows[0]).map((key) => ({
        field: key,
        headerName: key,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 120,
      }))

      setColDefs(columns)
      setRowData(rows)
      setRowCount(rows.length)
    } catch (err) {
      setError('Could not reach the server. Is Spring Boot running on port 8080?')
    } finally {
      setLoading(false)
    }
  }, [filename])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') loadFile()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Data Viewer</h1>
        <p className="subtitle">Load an Excel file from the server and explore it below</p>
      </header>

      <div className="controls">
        <input
          type="text"
          className="file-input"
          placeholder="e.g. sales.xlsx"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="load-btn"
          onClick={loadFile}
          disabled={loading || !filename.trim()}
        >
          {loading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {rowCount !== null && !error && (
        <div className="row-count">{rowCount} row{rowCount !== 1 ? 's' : ''} loaded</div>
      )}

      {colDefs.length > 0 && (
        <div className="ag-theme-alpine grid-container">
          <AgGridReact
            rowData={rowData}
            columnDefs={colDefs}
            pagination={true}
            paginationPageSize={20}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
          />
        </div>
      )}
    </div>
  )
}

export default App
