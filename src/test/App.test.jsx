import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'

// Helper: mock a successful fetch response
function mockFetchSuccess(rows) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      message: `Loaded ${rows.length} row(s)`,
      data: rows,
    }),
  })
}

// Helper: mock a failed fetch response
function mockFetchError(message) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ success: false, message }),
  })
}

// Helper: mock a network failure
function mockFetchNetworkFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

const SAMPLE_ROWS = [
  { Month: 'Jan', Sales: 100, Costs: 80 },
  { Month: 'Feb', Sales: 150, Costs: 90 },
  { Month: 'Mar', Sales: 200, Costs: 110 },
]

describe('App — file loader bar', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders title and input on load', () => {
    render(<App />)
    expect(screen.getByText('Data Viewer')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. sales.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()
  })

  it('Load button is disabled when input is empty', () => {
    render(<App />)
    expect(screen.getByText('Load')).toBeDisabled()
  })

  it('Load button enables when filename is typed', () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    expect(screen.getByText('Load')).not.toBeDisabled()
  })

  it('shows error when input is blank and Load is clicked via keyboard Enter', async () => {
    render(<App />)
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. sales.xlsx'), { key: 'Enter' })
    expect(await screen.findByText('Please enter a filename.')).toBeInTheDocument()
  })
})

describe('App — successful file load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess(SAMPLE_ROWS)
  })

  it('calls the correct API endpoint with the filename', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('file=sales.xlsx')
      )
    })
  })

  it('shows row count after successful load', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByText('3 rows loaded')).toBeInTheDocument()
    })
  })

  it('renders the chart after load', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByTestId('highcharts-mock')).toBeInTheDocument()
    })
  })

  it('renders the grid after load', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument()
    })
  })

  it('shows Line and Bar toggle buttons after load', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByText('Line')).toBeInTheDocument()
      expect(screen.getByText('Bar')).toBeInTheDocument()
    })
  })

  it('Line button is active by default', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByText('Line')).toHaveClass('active')
      expect(screen.getByText('Bar')).not.toHaveClass('active')
    })
  })

  it('clicking Bar makes it active', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => screen.getByText('Bar'))
    fireEvent.click(screen.getByText('Bar'))

    expect(screen.getByText('Bar')).toHaveClass('active')
    expect(screen.getByText('Line')).not.toHaveClass('active')
  })
})

describe('App — chart point click → grid highlight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess(SAMPLE_ROWS)
  })

  it('does not throw when grid ref is not ready', () => {
    render(<App />)
    expect(screen.getByText('Data Viewer')).toBeInTheDocument()
  })

  it('renders grid after load so click-to-highlight has a target', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))
    await waitFor(() => expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument())
  })

  it('renders chart after load so points are clickable', async () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))
    await waitFor(() => expect(screen.getByTestId('highcharts-mock')).toBeInTheDocument())
  })
})

describe('App — error handling', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows error message when API returns failure', async () => {
    mockFetchError('File not found: missing.xlsx')
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'missing.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByText('File not found: missing.xlsx')).toBeInTheDocument()
    })
  })

  it('shows server error when network fails', async () => {
    mockFetchNetworkFailure()
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'sales.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => {
      expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument()
    })
  })

  it('does not show chart or grid on error', async () => {
    mockFetchError('File not found')
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('e.g. sales.xlsx'), {
      target: { value: 'bad.xlsx' },
    })
    fireEvent.click(screen.getByText('Load'))

    await waitFor(() => screen.getByText('File not found'))
    expect(screen.queryByTestId('highcharts-mock')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ag-grid-mock')).not.toBeInTheDocument()
  })
})
