import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Room from './pages/Room'
import React from 'react'
import './index.css'

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white p-8 text-red-600 flex flex-col items-center justify-center">
          <div className="max-w-2xl w-full">
            <h1 className="text-3xl font-bold mb-4">糟糕，应用遇到了问题</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h2 className="font-semibold mb-2">错误信息:</h2>
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
            {this.state.errorInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 overflow-auto max-h-96">
                <h2 className="font-semibold mb-2 text-gray-700">组件堆栈:</h2>
                <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              重新加载应用
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  )
}

export default App
