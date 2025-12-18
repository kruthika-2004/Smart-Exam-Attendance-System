import { Search, Bell, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface TopBarProps {
  title: string;
  onSearch?: (query: string) => void;
  onNewAction?: () => void;
  showSearch?: boolean;
  showNewButton?: boolean;
}

export function TopBar({ title, onSearch, onNewAction, showSearch = true, showNewButton = true }: TopBarProps) {
  return (
    <div className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-[#0F172A]">{title}</h1>

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => onSearch?.(e.target.value)}
              className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6CF9] focus:border-transparent"
            />
          </div>
        )}

        <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444] rounded-full"></span>
        </button>

        {showNewButton && onNewAction && (
          <Button onClick={onNewAction} className="flex items-center gap-2">
            <Plus size={18} />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
