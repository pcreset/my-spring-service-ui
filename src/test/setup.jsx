import '@testing-library/jest-dom'
import React from 'react'

// Mock Highcharts — requires real DOM canvas
vi.mock('highcharts', () => ({
  default: { setOptions: vi.fn() }
}))

vi.mock('highcharts-react-official', () => ({
  default: () => <div data-testid="highcharts-mock">Chart</div>
}))

// Mock AG Grid with a ref-compatible component that exposes a mock API
vi.mock('ag-grid-react', () => ({
  AgGridReact: React.forwardRef((props, ref) => {
    // Build a mock grid API so click-to-highlight logic can call it safely
    React.useImperativeHandle(ref, () => ({
      api: {
        forEachNode:            vi.fn(),
        deselectAll:            vi.fn(),
        paginationGoToPage:     vi.fn(),
        paginationGetPageSize:  vi.fn(() => 20),
        ensureIndexVisible:     vi.fn(),
      }
    }))
    return <div data-testid="ag-grid-mock">Grid</div>
  })
}))

vi.mock('ag-grid-community/styles/ag-grid.css',        () => ({}))
vi.mock('ag-grid-community/styles/ag-theme-alpine.css', () => ({}))
