import React, { useState, useCallback, useMemo, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsReactOfficial from 'highcharts-react-official'
const HighchartsReact = HighchartsReactOfficial.default ?? HighchartsReactOfficial
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import ErrorBoundary from './ErrorBoundary'
import './App.css'

const API_BASE    = 'http://localhost:8080/api/v1'
const CHART_HEIGHT = 220
const PAGE_SIZE    = 20

function App() {
  const gridRef = useRef(null)

  const [filename, setFilename]   = useState('')
  const [rowData, setRowData]     = useState([])
  const [colDefs, setColDefs]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [rowCount, setRowCount]   = useState(null)
  const [chartType, setChartType] = useState('line')

  const loadFile = useCallback(async () => {
    if (!filename.trim()) { setError('Please enter a filename.'); return }

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

      const columns = Object.keys(rows[0]).map((key, idx) => ({
        field: key,
        headerName: key,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 120,
        pinned: idx === 0 ? 'left' : null,
      }))

      setColDefs(columns)
      setRowData(rows)
      setRowCount(rows.length)
    } catch (err) {
      console.error('Load error:', err)
      setError('Could not reach the server. Is Spring Boot running on port 8080?')
    } finally {
      setLoading(false)
    }
  }, [filename])

  /**
   * Called when a Highcharts data point is clicked.
   * Finds the matching row in AG Grid, navigates to its page, and selects it.
   */
  const handleChartPointClick = useCallback((point) => {
    const api = gridRef.current?.api
    if (!api || !colDefs.length) return

    const xKey         = colDefs[0].field
    const clickedValue = String(point.category)

    // Find the absolute row index matching the clicked X value
    let targetIndex = -1
    api.forEachNode((node) => {
      if (targetIndex === -1 && String(node.data[xKey]) === clickedValue) {
        targetIndex = node.rowIndex
      }
    })

    if (targetIndex === -1) return

    // Navigate to the correct page
    const targetPage = Math.floor(targetIndex / PAGE_SIZE)
    api.paginationGoToPage(targetPage)

    // Wait for the page to render, then select and scroll to the row
    setTimeout(() => {
      api.deselectAll()
      api.forEachNode((node) => {
        if (node.rowIndex === targetIndex) {
          node.setSelected(true)
          api.ensureIndexVisible(node.rowIndex, 'middle')
        }
      })
    }, 80)
  }, [colDefs])

  // Build Highcharts options, wiring in the point click handler
  const chartOptions = useMemo(() => {
    if (!rowData.length || !colDefs.length) return null

    const keys       = colDefs.map(c => c.field)
    const xKey       = keys[0]
    const yKeys      = keys.slice(1)
    const categories = rowData.map(r => String(r[xKey]))

    const series = yKeys.map(key => ({
      name: key,
      type: chartType,
      data: rowData.map(r => {
        const val = r[key]
        return typeof val === 'number' ? val : parseFloat(val) || 0
      }),
    }))

    return {
      chart: {
        type: chartType,
        height: CHART_HEIGHT,
        animation: false,
        style: { fontFamily: 'inherit' },
        backgroundColor: '#ffffff',
        marginTop: 24,
      },
      title: {
        text: filename,
        style: { fontSize: '12px', fontWeight: '600', color: '#555' },
      },
      xAxis: { categories, crosshair: true },
      yAxis: { title: { text: null } },
      tooltip: { shared: true },
      legend: { enabled: yKeys.length > 1, itemStyle: { fontSize: '11px' } },
      credits: { enabled: false },
      plotOptions: {
        series: {
          animation: false,
          cursor: 'pointer',
          point: {
            events: {
              click: function () {
                handleChartPointClick(this)
              },
            },
          },
        },
      },
      series,
    }
  }, [rowData, colDefs, chartType, filename, handleChartPointClick])

  return (
    <div className="app">

      {/* ── File loader bar ── */}
      <div className="top-bar">
        <h1 className="title">Data Viewer</h1>
        <div className="controls">
          <input
            type="text"
            className="file-input"
            placeholder="e.g. sales.xlsx"
            value={filename}
            onChange={e => setFilename(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadFile()}
            disabled={loading}
          />
          <button
            className="load-btn"
            onClick={loadFile}
            disabled={loading || !filename.trim()}
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        {rowCount !== null && !error && (
          <span className="row-count">
            {rowCount} row{rowCount !== 1 ? 's' : ''} loaded
          </span>
        )}
      </div>

      {/* ── Chart section ── */}
      {chartOptions && (
        <div className="chart-section">
          <div className="chart-toolbar">
            <button
              className={`toggle-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
            >Line</button>
            <button
              className={`toggle-btn ${chartType === 'column' ? 'active' : ''}`}
              onClick={() => setChartType('column')}
            >Bar</button>
          </div>
          <ErrorBoundary>
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          </ErrorBoundary>
        </div>
      )}

      {/* ── Grid section ── */}
      {colDefs.length > 0 && (
        <div className="grid-section">
          <ErrorBoundary>
            <div className="ag-theme-alpine grid-container">
              <AgGridReact
                ref={gridRef}
                rowData={rowData}
                columnDefs={colDefs}
                pagination={true}
                paginationPageSize={PAGE_SIZE}
                rowSelection="single"
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
              />
            </div>
          </ErrorBoundary>
        </div>
      )}

    </div>
  )
}

export default App
