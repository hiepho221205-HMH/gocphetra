import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { Shield, Briefcase, Coffee, Check, RefreshCw } from 'lucide-react';

export default function DemoRoleSwitcher() {
  const { currentRole, switchDemoRole } = usePos();
  const [isSwitching, setIsSwitching] = useState(false);

  // In production builds, disable role switcher unless explicitly enabled for QA testing
  if (import.meta.env.PROD && (typeof window === 'undefined' || !window.__ENABLE_DEMO_SWITCHER__)) {
    return null;
  }

  const handleSelectRole = async (role) => {
    if (role === currentRole || isSwitching) return;
    setIsSwitching(true);
    try {
      if (typeof switchDemoRole === 'function') {
        await switchDemoRole(role);
      }
    } finally {
      setTimeout(() => setIsSwitching(false), 200);
    }
  };

  const roles = [
    {
      id: 'admin',
      label: 'Admin',
      name: 'Trần Mai',
      icon: Shield,
      activeBg: 'bg-emerald-800 text-white shadow-xs',
      inactiveBg: 'bg-white/80 text-emerald-950 hover:bg-emerald-50'
    },
    {
      id: 'manager',
      label: 'Manager',
      name: 'Nguyễn Hùng',
      icon: Briefcase,
      activeBg: 'bg-blue-800 text-white shadow-xs',
      inactiveBg: 'bg-white/80 text-blue-950 hover:bg-blue-50'
    },
    {
      id: 'staff',
      label: 'Staff',
      name: 'Hoàng Nam',
      icon: Coffee,
      activeBg: 'bg-amber-800 text-white shadow-xs',
      inactiveBg: 'bg-white/80 text-amber-950 hover:bg-amber-50'
    }
  ];

  return (
    <aside
      aria-label="Thanh điều hướng demo vai trò"
      data-testid="demo-role-switcher"
      className="w-full bg-[#1A2E20] text-white px-3 py-1.5 flex items-center justify-between text-xs z-30 shrink-0 border-b border-emerald-900/60 shadow-xs"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Demo RBAC
        </span>
        <span className="hidden xs:inline text-[11px] text-emerald-100/70 font-medium">
          Chuyển đổi vai trò:
        </span>
      </div>

      <div className="flex items-center gap-1">
        {roles.map((r) => {
          const Icon = r.icon;
          const isActive = currentRole === r.id;

          return (
            <button
              key={r.id}
              type="button"
              data-testid={`demo-switch-to-${r.id}-btn`}
              onClick={() => handleSelectRole(r.id)}
              disabled={isSwitching}
              className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isActive ? r.activeBg : r.inactiveBg
              }`}
            >
              {isSwitching && isActive ? (
                <RefreshCw className="w-3 h-3 animate-spin text-white" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              <span>{r.label}</span>
              {isActive && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
