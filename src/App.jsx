import React, { useState, useMemo, useEffect, useRef } from 'react';

// --- BUILT-IN ICONS (Zero installation required) ---
const Icon = ({ d, size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const Icons = {
  Upload: (p) => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" {...p} />,
  Chart: (p) => <Icon d="M12 20V10M18 20V4M6 20v-4" {...p} />,
  Download: (p) => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" {...p} />,
  Globe: (p) => <Icon d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 0c-1.5 2-2.5 5-2.5 10s1 8 2.5 10M12 2c1.5 2 2.5 5 2.5 10s-1 8-2.5 10M2 12h20" {...p} />,
  ChevronRight: (p) => <Icon d="m9 18 6-6-6-6" {...p} />,
  X: (p) => <Icon d="M18 6 6 18M6 6l12 12" {...p} />,
  Message: (p) => <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p} />,
  Sparkles: (p) => <Icon d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" {...p} />,
  Map: (p) => <Icon d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-15v15" {...p} />,
  Up: (p) => <Icon d="M7 17L17 7M7 7h10v10" {...p} />,
  Down: (p) => <Icon d="M7 7l10 10M17 7v10H7" {...p} />
};

// --- UTILS & PARSING ---
const getMappedKey = (rawHeader) => {
  if (!rawHeader) return '';
  const h = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (h.includes('month') || h.includes('date')) return 'date';
  if (h.includes('country')) return 'country';
  if (h.includes('region')) return 'region';
  if (h.includes('platform') || h.includes('source') || h.includes('vendor')) return 'platform';
  if (h.includes('mncs') || h.includes('deposits') || h.includes('conv')) return 'mncs';
  if (h.includes('ltv')) return 'ltv';
  if (h.includes('payback')) return 'payback';
  if (h.includes('spend') || h.includes('cost')) return 'spend';
  return h;
};

const safeParseNum = (val) => {
  if (typeof val === 'number') return val;
  const cleaned = String(val || '0').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => getMappedKey(h.trim().replace(/^"|"$/g, '')));
  
  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      let val = values[i];
      if (h === 'platform' && val) {
        const p = val.toLowerCase();
        if (p.includes('google')) val = 'Google AC';
        else if (p.includes('trade')) val = 'TTD';
        else if (p.includes('moloco')) val = 'Moloco';
      }
      if (h === 'date' && val) {
        const m = val.match(/^(\d{4})[-/](\d{2})/);
        if (m) val = `${m[1]}-${m[2]}`;
      }
      obj[h] = val;
    });
    return obj;
  });
}

const REGIONS = ['GLOBAL', 'NORTHAM', 'LATAM', 'ASIA', 'PACIFIC', 'GBR', 'EUROPE', 'ROW', 'MEA'];

// --- COMPONENTS ---
const PlatformDashboard = ({ 
  title, dashboard, formatCurrency, formatCPA, formatNumber, isGlobal,
  onNarrativeSync, commentary
}) => {
  if (!dashboard || dashboard.trend.length === 0) return null;
  const { trend, contributionList } = dashboard;
  
  const svgWidth = 1000, svgHeight = 500; 
  const pL = 80, pR = 80, pY = 60, cW = svgWidth - pL - pR, cH = svgHeight - pY * 2;
  
  const maxMnc = Math.max(...trend.map(d => d.mncs), 1) * 1.35;
  const maxPb = Math.max(...trend.map(d => d.payback), 1, 20) * 1.35;
  const maxSpend = Math.max(...trend.map(d => d.spend), 1) * 1.35;
  const maxLtv = Math.max(...trend.map(d => d.ltv), 1) * 1.35;

  const step = trend.length > 1 ? cW / (trend.length - 1) : 0;
  const getY = (val, max) => pY + cH - ((val / max) * cH);
  const getX = (i) => pL + i * step;

  const buildPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const spendPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.spend, maxSpend) }));
  const paybackPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.payback, maxPb) }));
  const ltvPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.ltv, maxLtv) }));

  const ChangeBadge = ({ val }) => {
    if (val === null || !isFinite(val) || val === 0) return <span className="text-slate-300">-</span>;
    const isPos = val >= 0;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isPos ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
        {isPos ? '+' : ''}{(val * 100).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col mb-20 overflow-visible page-break-inside-avoid">
      <div className="bg-[#1a3812] px-10 py-6 border-b border-slate-200 flex justify-between items-center rounded-t-[2.5rem]">
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center">
          <Icons.ChevronRight size={24} className="mr-2 text-green-400" /> {title}
        </h3>
        <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.4em]">{isGlobal ? 'Regional Synthesis' : 'Market Analysis'}</span>
      </div>
      
      <div className="p-10 space-y-12">
        <div className="w-full bg-white overflow-visible border-b border-slate-50 pb-8">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible block">
            <defs>
              <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
                <feFlood floodColor="white" result="bg" />
                <feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="dilated" />
                <feComposite in="bg" in2="dilated" operator="in" result="outline" />
                <feMerge><feMergeNode in="outline" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map(r => <line key={r} x1={pL} y1={pY + cH * r} x2={svgWidth - pR} y2={pY + cH * r} stroke="#f1f5f9" strokeWidth="1" />)}
            
            {/* Trend Lines - RESTORED */}
            <path d={buildPath(spendPoints)} fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.4" />
            <path d={buildPath(ltvPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.4" />
            <path d={buildPath(paybackPoints)} fill="none" stroke="#f59e0b" strokeWidth="4" />

            {trend.map((d, i) => {
              const x = getX(i);
              const mncH = (d.mncs / maxMnc) * cH;
              const pbY = getY(d.payback, maxPb);
              const spendY = getY(d.spend, maxSpend);
              const ltvY = getY(d.ltv, maxLtv);
              
              // Pill label logic with collision avoidance
              const labels = [
                { id: 's', val: `£${Math.round(d.spend/1000)}k`, y: spendY, color: '#ef4444' },
                { id: 'pb', val: `${d.payback.toFixed(1)}m`, y: pbY, color: '#f59e0b' },
                { id: 'ltv', val: `£${Math.round(d.ltv)}`, y: ltvY, color: '#10b981' }
              ].sort((a, b) => a.y - b.y);

              if (labels[1].y - labels[0].y < 24) labels[1].y = labels[0].y + 24;
              if (labels[2].y - labels[1].y < 24) labels[2].y = labels[1].y + 24;

              return (
                <g key={i}>
                  <rect x={x - 15} y={pY + cH - mncH} width={30} height={mncH} fill="#6366f1" fillOpacity={d.spend > 0 ? 0.8 : 0.2} rx={4} />
                  
                  {d.spend > 0 && labels.map(lbl => (
                    <g key={lbl.id}>
                      <rect x={x - 20} y={lbl.y - 30} width={40} height={18} rx={9} fill="white" stroke={lbl.color} strokeWidth="1.2" />
                      <text x={x} y={lbl.y - 18} textAnchor="middle" fill={lbl.color} fontSize="9" fontWeight="900" filter="url(#halo)">{lbl.val}</text>
                    </g>
                  ))}
                  
                  <circle cx={x} cy={pbY} r="5" fill="#f59e0b" stroke="white" strokeWidth="2" />
                  <circle cx={x} cy={spendY} r="4" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                  
                  <text x={x} y={pY + cH + 30} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" transform={`rotate(-35, ${x}, ${pY + cH + 30})`}>{d.month}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
          <table className="w-full text-center text-xs">
            <thead className="bg-slate-50 border-b text-slate-400 font-black uppercase tracking-widest">
              <tr>
                <th className="py-5 px-8 text-left">{isGlobal ? 'Region' : 'Market'}</th>
                <th className="py-5 px-4 text-right">Investment</th>
                <th className="py-5 px-4 text-right">MNCs</th>
                <th className="py-5 px-4">MoM%</th>
                <th className="py-5 px-4">YoY%</th>
                <th className="py-5 px-4 text-[#ef4444]">CPA</th>
                <th className="py-5 px-4 text-right pr-10">PB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {contributionList.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-4 px-8 text-left uppercase text-slate-900 font-black">{item.label}</td>
                  <td className="py-4 px-4 text-right text-slate-500">{formatCurrency(item.spend)}</td>
                  <td className="py-4 px-4 text-right text-slate-900">{formatNumber(item.mncs)}</td>
                  <td className="py-4 px-4"><ChangeBadge val={item.momChange} /></td>
                  <td className="py-4 px-4"><ChangeBadge val={item.yoyChange} /></td>
                  <td className="py-4 px-4 text-[#ef4444] font-black">{formatCPA(item.cpa)}</td>
                  <td className="py-4 px-4 text-right pr-10 text-slate-900 font-black">{item.payback.toFixed(1)}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6 pt-8 border-t border-slate-50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#1a3812]">
                   <Icons.Message size={20} />
                   <h4 className="font-black text-sm uppercase tracking-widest">Strategic Narrative</h4>
                </div>
                <button onClick={() => onNarrativeSync(title)} className="text-[10px] font-black uppercase text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100 hover:bg-green-100 no-print">Sync Data</button>
            </div>
            <textarea 
               value={commentary || ''} 
               onChange={(e) => onNarrativeSync(title, e.target.value)}
               placeholder="Enter analysis here..."
               className="w-full p-8 bg-slate-50 rounded-[2rem] border-0 text-slate-800 text-sm italic font-medium leading-relaxed min-h-[120px] focus:ring-2 focus:ring-green-100 resize-none"
            />
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [data, setData] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('GLOBAL');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [comments, setComments] = useState({});
  const platforms = ['Google AC', 'TTD', 'Moloco'];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length) {
        setData(parsed);
        const dates = [...new Set(parsed.map(d => d.date))].sort().reverse();
        setSelectedMonth(dates[0]);
      }
    };
    reader.readAsText(file);
  };

  const aggregate = (records) => {
    let s = 0, m = 0, lSum = 0, pWSum = 0;
    records.forEach(r => {
      const spend = safeParseNum(r.spend);
      const mncs = Math.round(safeParseNum(r.mncs));
      const pb = safeParseNum(r.payback);
      const ltv = safeParseNum(r.ltv);
      s += spend; m += mncs; lSum += ltv * mncs; pWSum += pb * mncs;
    });
    return { spend: s, mncs: m, cpa: m > 0 ? s / m : 0, payback: m > 0 ? pWSum / m : 0, ltv: m > 0 ? lSum / m : 0 };
  };

  const dashboardData = useMemo(() => {
    if (!data.length || !selectedMonth) return {};
    const res = {};
    const [y, m] = selectedMonth.split('-').map(Number);
    const pmS = `${m === 1 ? y-1 : y}-${String(m === 1 ? 12 : m-1).padStart(2, '0')}`;
    const pyS = `${y-1}-${String(m).padStart(2, '0')}`;

    platforms.forEach(p => {
      const allDates = [...new Set(data.map(d => d.date))].sort();
      const trend = allDates.map(date => {
        const match = data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === date && r.platform === p);
        return { month: date, ...aggregate(match) };
      });

      const current = data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === selectedMonth && r.platform === p);
      const uniqueLabels = [...new Set(current.map(r => selectedRegion === 'GLOBAL' ? (r.region || 'Unknown') : (r.country || 'Unknown')))];
      
      const contributionList = uniqueLabels.map(label => {
        const filterFn = (r) => (selectedRegion === 'GLOBAL' ? r.region : r.country) === label && r.platform === p;
        const curAgg = aggregate(data.filter(r => filterFn(r) && r.date === selectedMonth));
        const pmAgg = aggregate(data.filter(r => filterFn(r) && r.date === pmS));
        const pyAgg = aggregate(data.filter(r => filterFn(r) && r.date === pyS));
        return { label, ...curAgg, momChange: pmAgg.mncs ? (curAgg.mncs - pmAgg.mncs)/pmAgg.mncs : 0, yoyChange: pyAgg.mncs ? (curAgg.mncs - pyAgg.mncs)/pyAgg.mncs : 0 };
      }).sort((a,b) => b.spend - a.spend);
      
      res[p] = { trend, contributionList };
    });
    return res;
  }, [data, selectedRegion, selectedMonth]);

  const mainKpis = useMemo(() => {
    if (!data.length || !selectedMonth) return null;
    const match = data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === selectedMonth);
    return aggregate(match);
  }, [data, selectedRegion, selectedMonth]);

  const handleSync = (p, text = null) => {
    const key = `${selectedRegion}_${selectedMonth}_${p}`;
    if (typeof text === 'string') {
        setComments(prev => ({ ...prev, [key]: text }));
    } else {
        const dash = dashboardData[p];
        const cur = dash.trend.find(t => t.month === selectedMonth);
        const autoText = `${selectedMonth} analysis for ${p} in ${selectedRegion}:\nGrowth of ${cur.mncs.toLocaleString()} MNCs achieved with a weighted payback of ${cur.payback.toFixed(1)}m.`;
        setComments(prev => ({ ...prev, [key]: autoText }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-32">
      <nav className="w-full bg-[#1a3812] p-8 flex items-center justify-between no-print shadow-2xl border-b-[8px] border-green-900/20">
        <div className="flex items-center space-x-4">
          <div className="bg-white/10 p-2 rounded-xl"><Icons.Chart size={28} className="text-green-400" /></div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Monthly report tool</h1>
        </div>
        <div className="flex items-center gap-6">
          {!data.length ? (
            <label className="flex items-center px-10 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs cursor-pointer hover:bg-green-500 shadow-lg">
              <Icons.Upload size={20} className="mr-3" /> Connect Data
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex bg-white/10 p-1 rounded-2xl border border-white/10">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-white font-bold px-4 py-2 outline-none text-xs">
                  {[...new Set(data.map(d => d.date))].sort().reverse().map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                </select>
                <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent text-white font-bold px-4 py-2 outline-none text-xs border-l border-white/10">
                  {REGIONS.map(r => <option key={r} value={r} className="text-black">{r}</option>)}
                </select>
              </div>
              <button onClick={() => window.print()} className="bg-white text-[#1a3812] px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-lg">Export PDF</button>
              <button onClick={() => setData([])} className="bg-red-500/20 p-4 rounded-2xl text-red-100 hover:bg-red-600"><Icons.X size={20} /></button>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-12">
        {mainKpis ? (
          <div className="space-y-16 animate-in fade-in duration-700">
            <header className="border-l-[12px] border-green-600 pl-12 py-6 mb-20">
              <h2 className="text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                {selectedRegion} <span className="text-green-600 block">{selectedMonth}</span>
              </h2>
              <p className="text-slate-400 font-black uppercase tracking-[0.6em] mt-12 text-[11px]">Growth Synthesis Dossier</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { l: 'Total Investment', v: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(mainKpis.spend) },
                { l: 'Growth (MNCs)', v: new Intl.NumberFormat('en-US').format(mainKpis.mncs) },
                { l: 'Weighted Payback', v: `${mainKpis.payback.toFixed(1)}m` },
              ].map((k, i) => (
                <div key={i} className="bg-white rounded-[3rem] p-12 border shadow-xl flex flex-col justify-between hover:scale-105 transition-transform">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-10">{k.l}</span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{k.v}</span>
                </div>
              ))}
            </div>

            {platforms.map(p => (
              <PlatformDashboard 
                key={p} title={p} dashboard={dashboardData[p]} 
                formatCurrency={v => `£${Math.round(v/1000)}k`} 
                formatCPA={v => `£${v.toFixed(2)}`} 
                formatNumber={v => v.toLocaleString()}
                isGlobal={selectedRegion === 'GLOBAL'}
                onNarrativeSync={handleSync}
                commentary={comments[`${selectedRegion}_${selectedMonth}_${p}`]}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center no-print">
            <div className="bg-white p-24 rounded-[5rem] shadow-2xl border-4 border-dashed border-slate-100 max-w-3xl">
              <Icons.Chart size={100} className="text-green-600 mx-auto mb-10 transform -rotate-12" />
              <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-6 uppercase leading-none">Intelligence Hub</h3>
              <p className="text-slate-400 font-bold mb-12 text-2xl">Connect your CSV source to begin synthesis.</p>
              <label className="inline-flex items-center px-16 py-8 bg-[#1a3812] text-white rounded-[2.5rem] font-black uppercase cursor-pointer hover:scale-105 transition-all shadow-2xl">
                <Icons.Upload size={24} className="mr-4" /> Select Data File
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { 
          .no-print { display: none !important; }
          body { background: white !important; }
          .max-w-5xl { max-width: 100% !important; padding: 0 !important; width: 100% !important; }
        }
        .animate-in { animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
