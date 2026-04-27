import React from 'react'

/**
 * Catches rendering errors anywhere in the child tree
 * and shows a readable message instead of a blank page.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          margin: '20px', padding: '16px',
          background: '#fff5f5', border: '1px solid #fc8181',
          borderRadius: '8px', color: '#c53030'
        }}>
          <strong>Something went wrong rendering this section.</strong>
          <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
