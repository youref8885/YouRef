import { currency } from "../../utils";

export function PipelineFunnel({ data }) {
  // data: { prospect, contact, management, closing } - each is an array of { label, value }
  const stages = [
    { id: 'prospect', label: 'Prospectos', color: '#d4af37', items: data.prospect },
    { id: 'contact', label: 'Contactos', color: '#b66549', items: data.contact },
    { id: 'management', label: 'Gestión', color: '#183153', items: data.management },
    { id: 'closing', label: 'Cierres', color: '#0d5d56', items: data.closing },
  ];

  const totals = stages.map(s => s.items.reduce((acc, i) => acc + (i.value || 0), 0));
  const max = Math.max(...totals, 1);

  return (
    <div className="premium-card h-full flex flex-col">
      <div className="mb-6">
        <div className="premium-eyebrow">Flujo de Conversión</div>
        <h3 className="font-display text-2xl font-bold tracking-tight text-slate-950">Embudo de Ventas</h3>
      </div>
      
      <div className="flex-1 flex flex-col gap-2 relative">
        {stages.map((stage, idx) => {
          const total = totals[idx];
          const width = (total / max) * 65; // Cap bar at 65% width to leave space for labels
          const percentage = ((total / max) * 100).toFixed(0);

          return (
            <div key={stage.id} className="group relative flex items-center h-full min-h-[64px] py-1">
              {/* Funnel Segment */}
              <div 
                className="h-full rounded-2xl transition-all duration-700 ease-out relative overflow-hidden shadow-sm group-hover:shadow-md group-hover:scale-[1.01] funnel-segment"
                style={{ 
                  width: `${Math.max(width, 12)}%`, 
                  background: `linear-gradient(90deg, ${stage.color} 0%, ${stage.color}dd 100%)`,
                  opacity: 0.85 + (idx * 0.05)
                }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Label & Stats */}
              <div className="ml-6 flex-1 min-w-[140px]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">{stage.label}</span>
                  <span className="text-xl font-display font-bold text-slate-950">{total}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{percentage}% del pico máximo</div>
              </div>
            </div>
          );
        })}
        
        {/* Decorative lines connecting segments */}
        <div className="absolute left-[7.5%] top-0 bottom-0 w-px -z-10" />
      </div>
    </div>
  );
}
