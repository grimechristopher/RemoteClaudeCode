// Get auth token from localStorage
export function getAuthToken(): string | null {
  return localStorage.getItem('supabase.auth.token')
}

// Set auth token in localStorage
export function setAuthToken(token: string): void {
  localStorage.setItem('supabase.auth.token', token)
}

// Clear auth token from localStorage
export function clearAuthToken(): void {
  localStorage.removeItem('supabase.auth.token')
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!getAuthToken()
}

// Add Authorization header to fetch options
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (!token) {
    return {}
  }
  return {
    'Authorization': `Bearer ${token}`
  }
}
