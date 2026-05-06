import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-lg font-semibold text-blue-700">
        Evoke Sync
      </Link>
      <nav className="flex items-center gap-6">
        <Link to="/" className="text-sm text-gray-600 hover:text-blue-600">Dashboard</Link>
        <Link to="/reconciliation" className="text-sm text-gray-600 hover:text-blue-600">Reconciliation</Link>
        <Link to="/history" className="text-sm text-gray-600 hover:text-blue-600">History</Link>
        <Link to="/settings" className="text-sm text-gray-600 hover:text-blue-600">Settings</Link>
        <div className="flex items-center gap-3 border-l pl-6">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </nav>
    </header>
  );
}
