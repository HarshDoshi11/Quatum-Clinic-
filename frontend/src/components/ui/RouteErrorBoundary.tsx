import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

interface State {
  error: Error | null
}

/**
 * Wraps every page: if a page fails to render, the shell (sidebar, top bar, other pages) keeps working and the
 * page shows a calm, themed message with a way to try again. Routes remount per path, so navigating away resets it.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the details for whoever opens the console; the page itself stays calm.
    console.error('Page failed to render', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="px-[var(--page-pad-x)] pt-14" role="alert">
        <EmptyState
          tone="error"
          title="This page hit a problem."
          body="The rest of the app still works. Try the page again, or pick another page from the sidebar."
          action={
            <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }
}
