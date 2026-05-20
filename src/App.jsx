import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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

const EDITABLE_DETAIL_FIELDS = new Set(['selected', 'HumanInstruction'])

function App() {
  const gridRef  = useRef(null)
  const chartRef = useRef(null)

  const [filename, setFilename]   = useState('')
  const [rowData, setRowData]     = useState([])
  const [colDefs, setColDefs]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [rowCount, setRowCount]   = useState(null)
  const [chartType, setChartType]     = useState('line')
  const [selectedRow, setSelectedRow] = useState(null)
  const [showColPanel, setShowColPanel] = useState(false)
  const [hiddenCols, setHiddenCols]     = useState(new Set())
  const [editValues, setEditValues]     = useState({})

  const loadFile = useCallback(async () => {
    if (!filename.trim()) { setError('Please enter a filename.'); return }

    setLoading(true)
    setError('')
    setRowData([])
    setColDefs([])
    setRowCount(null)
    setSelectedRow(null)
    setShowColPanel(false)
    setHiddenCols(new Set())

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

      const keys = Object.keys(rows[0])
      const statusIdx = keys.indexOf('Status')

      const columns = keys.map((key, idx) => ({
        field: key,
        headerName: key,
        sortable: true,
        filter: true,
        resizable: true,
        editable: idx !== 0,
        ...(statusIdx !== -1 && idx > statusIdx
          ? { width: Math.max(key.length * 8 + 32, 80) }
          : { minWidth: 120 }),
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

  const onSelectionChanged = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const rows = api.getSelectedRows()
    const row  = rows.length > 0 ? rows[0] : null
    setSelectedRow(row)

    const chart = chartRef.current?.chart
    if (!chart) return

    // Deselect all existing chart point selections
    chart.getSelectedPoints().forEach(p => p.select(false, false))

    if (!row || !colDefs.length) return

    const xKey       = colDefs[0].field
    const xValue     = String(row[xKey])
    const categories = chart.xAxis[0]?.categories ?? []
    const pointIndex = categories.indexOf(xValue)
    if (pointIndex === -1) return

    // Select the matching point in every series
    chart.series.forEach(series => {
      const point = series.points?.[pointIndex]
      if (point) point.select(true, true)
    })
  }, [colDefs])

  useEffect(() => {
    if (!selectedRow) { setEditValues({}); return }
    const vals = {}
    EDITABLE_DETAIL_FIELDS.forEach(f => { if (f in selectedRow) vals[f] = selectedRow[f] })
    setEditValues(vals)
  }, [selectedRow])

  const handleDetailSave = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const nodes = api.getSelectedNodes()
    if (!nodes.length) return
    const node = nodes[0]
    const updatedData = { ...node.data, ...editValues }
    node.setData(updatedData)
    setSelectedRow(updatedData)
  }, [editValues])

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api?.exportDataAsCsv()
  }, [])

  const handleAutoSize = useCallback(() => {
    gridRef.current?.api?.autoSizeAllColumns()
  }, [])

  const toggleColVisibility = useCallback((field) => {
    setHiddenCols(prev => {
      const next = new Set(prev)
      const willBeVisible = next.has(field)
      willBeVisible ? next.delete(field) : next.add(field)
      gridRef.current?.api?.setColumnsVisible([field], willBeVisible)
      return next
    })
  }, [])

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
          allowPointSelect: true,
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

      {/* ── Main content: left panel + right detail ── */}
      <div className="main-content">

        <div className="left-panel">

          {/* Chart section */}
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
                <HighchartsReact ref={chartRef} highcharts={Highcharts} options={chartOptions} />
              </ErrorBoundary>
            </div>
          )}

          {/* Grid section */}
          {colDefs.length > 0 && (
            <div className="grid-section">

              {/* Grid toolbar */}
              <div className="grid-toolbar">
                <button className="tool-btn" onClick={handleExportCsv}>Export CSV</button>
                <button className="tool-btn" onClick={handleAutoSize}>Auto-size Columns</button>
                <div className="col-toggle-wrapper">
                  <button className="tool-btn" onClick={() => setShowColPanel(p => !p)}>
                    Columns {showColPanel ? '▲' : '▼'}
                  </button>
                  {showColPanel && (
                    <div className="col-panel">
                      {colDefs.map(col => (
                        <label key={col.field} className="col-panel-item">
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(col.field)}
                            onChange={() => toggleColVisibility(col.field)}
                          />
                          {col.headerName}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
                    multiSortKey="ctrl"
                    stopEditingWhenCellsLoseFocus={true}
                    onSelectionChanged={onSelectionChanged}
                  />
                </div>
              </ErrorBoundary>
            </div>
          )}

        </div>

        {/* Detail panel */}
        {colDefs.length > 0 && (
          <div className="detail-panel">
            <h2 className="detail-title">Row Details</h2>
            {selectedRow ? (
              <>
                <dl className="detail-list">
                  {Object.entries(selectedRow).map(([key, value]) => (
                    <div key={key} className="detail-row">
                      <dt className="detail-key">{key}</dt>
                      <dd className="detail-value">
                        {EDITABLE_DETAIL_FIELDS.has(key) ? (
                          key === 'HumanInstruction' ? (
                            <textarea
                              className="detail-textarea"
                              value={editValues[key] ?? ''}
                              onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          ) : typeof value === 'boolean' ? (
                            <input
                              type="checkbox"
                              className="detail-checkbox"
                              checked={!!editValues[key]}
                              onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.checked }))}
                            />
                          ) : (
                            <input
                              type="text"
                              className="detail-input"
                              value={editValues[key] ?? ''}
                              onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          )
                        ) : (
                          String(value ?? '')
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <button className="save-btn" onClick={handleDetailSave}>Save</button>
              </>
            ) : (
              <p className="detail-empty">Select a row or chart point to see details.</p>
            )}
          </div>
        )}

      </div>

    </div>
  )
}

export default App
