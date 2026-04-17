import React, { useState, useMemo, useEffect, useRef } from 'react';
// We use a direct CDN approach for icons to bypass environment installation issues
import * as LucideIcons from 'lucide-react';

const { 
  UploadCloud, BarChart3, Download, Globe, ChevronRight, XCircle, 
  MessageSquare, Save, Sparkles, Map, TrendingUp, FileText, 
  Printer, ChevronDown, Loader2, FileSearch, CheckCircle2, 
  AlertTriangle, ArrowUpRight, ArrowDownRight 
} = LucideIcons;

// --- UTILS & PARSING ---

const getMappedKey = (rawHeader) => {
  if (!rawHeader) return '';
  const h = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (h.includes('month') || h.includes('date')) return 'date';
  if (h.includes('country')) return 'country';
  if (h.includes('marketingregion')) return 'region';
  if (h.includes('region') && !h.includes('country')) return 'region';
  if (h.includes('vendor') || h.includes('platform') || h.includes('source')) return 'platform';
  if (h.includes('registrations') || h.includes('regs')) return 'regs';
  if (h.includes('mncs') || h.includes('deposits') || h.includes('conversions') || h.includes('convs')) return 'mncs';
  if (h.includes('ltv')) return 'ltv';
  if (h.includes('payback')) return 'payback';
  if (h.includes('spend') || h.includes('cost')) return 'spend';
  return rawHeader;
};

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (delimiter === l && s) l = row[++i] = '';
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1);
      row = ret[++r] = [l = '']; i = 0;
    } else row[i] += l;
    p = l;
  }
  if (ret[ret.length - 1].length === 1 && ret[ret.length - 1][0] === '') ret.pop();
  const headers = ret[0].map(h => getMappedKey(h));
  return ret.slice(1).map(line => {
    const obj = {};
    headers.forEach((mappedKey, index) => {
      let val = line[index] ? line[index].trim() : '';
      if (mappedKey === 'platform' && val) {
        const pStr = val.toLowerCase();
        if (pStr.includes('google')) val = 'Google AC';
        else if (pStr.includes('trade') || pStr.includes('ttd')) val = 'TTD';
        else if (pStr.includes('moloco')) val = 'Moloco';
      }
      if (mappedKey === 'date' && val) {
        const match = val.match(/^(\d{4})[-/](\d{2})/);
        if (match) val = `${match[1]}-${match[2]}`;
        else {
          const d = new Date(val);
          if (!isNaN(d.getTime())) val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      }
      if (mappedKey) obj[mappedKey] = val;
    });
    return obj;
  });
}

const REGIONS = ['GLOBAL', 'NORTHAM', 'LATAM', 'ASIA', 'PACIFIC', 'GBR', 'EUROPE', 'ROW', 'MEA'];
const PLATFORMS_MAP = {
  'Google App Campaigns': 'Google AC',
  'The Trade Desk': 'TTD',
  'Moloco': 'Moloco'
};

// --- COMPONENTS ---

const AutoExpandingTextarea = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = (textareaRef.current.scrollHeight) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full overflow-hidden transition-all resize-none block border-0 focus:ring-0 ${className}`}
      style={{ minHeight: '120px' }}
    />
  );
};

const PlatformDashboard = ({ 
  title, dashboard, formatCurrency, formatCPA, formatNumber, formatDecimal,
  commentary, roadmap, onCommentChange, onRoadmapChange, onAutoGenerate, isGlobal
}) => {
  if (!dashboard || dashboard.trend.length === 0) return null;
  const { trend, contributionList } = dashboard;
  
  const svgWidth = 1000, svgHeight = 550; 
  const pOuterL = 60, pInnerL = 80, pInnerR = 80, pOuterR = 60; 
  const chartLeft = pOuterL + pInnerL, chartRight = svgWidth - (pInnerR + pOuterR);
  const chartWidth = chartRight - chartLeft, paddingY = 70, chartHeight = svgHeight - paddingY * 2; 
  
  const maxSpend = Math.max(...trend.map(d => d.spend), 1) * 1.15; 
  const maxMnc = Math.max(...trend.map(d => d.mncs), 1) * 1.15;
  const maxLtv = Math.max(...trend.map(d => d.ltv), 1) * 1.15;
  const maxPayback = Math.max(...trend.map(d => d.payback), 1, 20) * 1.15; 
  
  const step = trend.length > 1 ? chartWidth / (trend.length - 1) : 0;
  const barWidth = Math.min(38, (chartWidth / Math.max(trend.length, 1)) * 0.45);
  const getY = (val, max) => paddingY + chartHeight - ((val / max) * chartHeight);
  const getX = (i) => chartLeft + (trend.length === 1 ? chartWidth / 2 : i * step);

  const buildPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const spendPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.spend, maxSpend) }));
  const paybackPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.payback, maxPayback) }));
  const ltvPoints = trend.map((d, i) => ({ x: getX(i), y: getY(d.ltv, maxLtv) }));

  const formatChangeBadge = (val) => {
    if (val == null || isNaN(val) || !isFinite(val)) return <span className="text-slate-300">-</span>;
    const isPos = val >= 0;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isPos ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
        {isPos ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}
        {(val * 100).toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col mb-20 overflow-visible">
      <div className="bg-[#1a3812] px-10 py-6 border-b border-slate-200 flex justify-between items-center rounded-t-[2.5rem]">
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center leading-none">
          <ChevronRight size={24} className="mr-2 text-green-400" />
          {title}
        </h3>
        <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.4em]">{isGlobal ? 'Global Data Stream' : 'Regional Data Stream'}</span>
      </div>
      
      <div className="p-10 space-y-16">
        <div className="w-full bg-white overflow-visible">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible font-sans select-none block chart-component-svg">
            <defs>
              <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
                <feFlood floodColor="white" result="bg" />
                <feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="dilated" />
                <feComposite in="bg" in2="dilated" operator="in" result="outline" />
                <feMerge><feMergeNode in="outline" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map(r => (
              <line key={`g-${r}`} x1={chartLeft} y1={paddingY + chartHeight * r} x2={chartRight} y2={paddingY + chartHeight * r} stroke="#f1f5f9" strokeWidth="1.5" />
            ))}
            <line x1={chartLeft} y1={getY(15, maxPayback)} x2={chartRight} y2={getY(15, maxPayback)} stroke="#94a3b8" strokeWidth="2" strokeDasharray="10 10" />
            
            {[0, 0.25, 0.5, 0.75, 1].map(r => {
              const y = paddingY + chartHeight * r, f = 1 - r;
              return (
                <g key={`lbl-${r}`} className="text-[10px] font-black opacity-30">
                  <text x={chartLeft - 10} y={y + 4} textAnchor="end" fill="#6366f1">{Math.round(maxMnc * f)}</text>
                  <text x={chartRight + 10} y={y + 4} textAnchor="start" fill="#10b981">£{Math.round(maxLtv * f)}</text>
                </g>
              );
            })}
            <path d={buildPath(spendPoints)} fill="none" stroke="#ef4444" strokeWidth="3" />
            <path d={buildPath(ltvPoints)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="8 6" />
            <path d={buildPath(paybackPoints)} fill="none" stroke="#f59e0b" strokeWidth="4" />
            
            {trend.map((d, i) => {
              const x = getX(i), hasSpend = d.spend > 0;
              const mncH = (d.mncs / maxMnc) * chartHeight, mncY = paddingY + chartHeight - mncH;
              const spendY = getY(d.spend, maxSpend), pbY = getY(d.payback, maxPayback), ltvY = getY(d.ltv, maxLtv);
              const pills = hasSpend ? [
                { id: 's', val: `£${Math.round(d.spend/1000)}k`, y: spendY, color: '#ef4444' },
                { id: 'pb', val: `${d.payback.toFixed(1)}m`, y: pbY, color: '#f59e0b' },
                { id: 'ltv', val: `£${Math.round(d.ltv)}`, y: ltvY, color: '#10b981' },
                { id: 'mnc', val: Math.round(d.mncs), y: mncY, color: '#6366f1' }
              ] : [];
              if (hasSpend) {
                pills.sort((a,b) => a.y - b.y);
                for(let k=1; k<pills.length; k++){ if(pills[k].y - pills[k-1].y < 24) pills[k].y = pills[k-1].y + 24; }
              }
              return (
                <g key={`data-${i}`}>
                  <rect x={x - barWidth/2} y={mncY} width={barWidth} height={mncH} fill="#6366f1" fillOpacity={hasSpend ? 1 : 0.2} rx={4} />
                  {hasSpend && (
                    <>
                      <circle cx={x} cy={spendY} r="4" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                      <circle cx={x} cy={pbY} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                      <circle cx={x} cy={ltvY} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" />
                      {pills.map(p => (
                        <g key={p.id}>
                          <rect x={x - 20} y={p.y - 28} width={40} height={18} rx={9} fill="white" stroke={p.color} strokeWidth="1.2" />
                          <text x={x} y={p.y - 16} textAnchor="middle" fill={p.color} fontSize="8" fontWeight="900" filter="url(#halo)">{p.val}</text>
                        </g>
                      ))}
                    </>
                  )}
                  <text x={x} y={paddingY + chartHeight + 40} textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="900" transform={`rotate(-35, ${x}, ${paddingY + chartHeight + 40})`}>{d.month}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* CONTRIBUTION MATRIX TABLE */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 text-indigo-600 opacity-60 px-2">
             <Globe size={18} />
             <h4 className="font-black text-[10px] uppercase tracking-[0.3em]">{isGlobal ? 'Regional Contribution Matrix' : 'Market Contribution Matrix'}</h4>
          </div>
          <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
            <table className="w-full text-center text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase tracking-widest">
                <tr>
                  <th className="py-5 px-8 text-left">{isGlobal ? 'Region' : 'Market'}</th>
                  <th className="py-5 px-6">Investment</th>
                  <th className="py-5 px-6">MNCs</th>
                  <th className="py-5 px-4">MoM %</th>
                  <th className="py-5 px-4">YoY %</th>
                  <th className="py-5 px-6 text-[#ef4444]">CPA</th>
                  <th className="py-5 px-6 text-[#10b981]">LTV</th>
                  <th className="py-5 px-6 text-[#f59e0b]">PB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {contributionList.slice(0, 12).map((item, i) => (
                  <tr key={`item-${i}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-8 text-left uppercase text-slate-900 text-sm tracking-tight">{item.label}</td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{formatCurrency(item.spend)}</td>
                    <td className="py-4 px-6 text-slate-900 font-black">{formatNumber(item.mncs)}</td>
                    <td className="py-4 px-4">{formatChangeBadge(item.momChange)}</td>
                    <td className="py-4 px-4">{formatChangeBadge(item.yoyChange)}</td>
                    <td className="py-4 px-6 text-[#ef4444] font-black">{formatCPA(item.cpa)}</td>
                    <td className="py-4 px-6 text-[#10b981]">£{Math.round(item.ltv)}</td>
                    <td className="py-4 px-6 text-[#f59e0b] font-black">{item.payback.toFixed(1)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-12 border-t border-slate-100 pt-12">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-3 text-[#1a3812]">
                  <MessageSquare size={24} />
                  <h4 className="font-black text-sm uppercase tracking-widest">Strategic Narrative</h4>
                </div>
                <button onClick={() => onAutoGenerate(title)} className="no-print flex items-center text-[10px] font-black text-green-700 bg-green-50 px-4 py-2 rounded-full border border-green-200 hover:bg-green-100 transition-all">
                  <Sparkles size={14} className="mr-2" /> Sync Context
                </button>
            </div>
            <AutoExpandingTextarea
              value={commentary || ''}
              onChange={(e) => onCommentChange(title, e.target.value)}
              className="p-8 text-[15px] font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-[2.5rem] leading-relaxed italic shadow-inner"
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-blue-900 px-2">
                <Map size={24} />
                <h4 className="font-black text-sm uppercase tracking-widest">Strategic Roadmap</h4>
            </div>
            <AutoExpandingTextarea
              value={roadmap || ''}
              onChange={(e) => onRoadmapChange(title, e.target.value)}
              className="p-8 text-[15px] font-medium text-slate-800 bg-blue-50/10 border border-blue-50 rounded-[2.5rem] leading-relaxed shadow-inner"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION ---

export default function App() {
  const [data, setData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('GLOBAL');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState(Object.keys(PLATFORMS_MAP));
  
  const [comments, setComments] = useState(() => JSON.parse(localStorage.getItem('adv_v26_comm') || '{}'));
  const [roadmaps, setRoadmaps] = useState(() => JSON.parse(localStorage.getItem('adv_v26_road') || '{}'));

  useEffect(() => {
    localStorage.setItem('adv_v26_comm', JSON.stringify(comments));
    localStorage.setItem('adv_v26_road', JSON.stringify(roadmaps));
  }, [comments, roadmaps]);

  const handleFileUpload = (e) => {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = parseCSV(event.target.result);
        if (parsed.length > 0) {
          setData(parsed);
          const dates = [...new Set(parsed.map(d => d.date).filter(Boolean))].sort().reverse();
          if (dates.length > 0) setSelectedMonth(dates[0] || '');
        }
      } catch (err) {} finally {
        setTimeout(() => setIsProcessing(false), 600);
      }
    };
    reader.readAsText(file);
  };

  const aggregateData = (records) => {
    let spend = 0, mncs = 0, ltvSum = 0, pbWeightedSum = 0;
    records.forEach(r => {
      const s = parseFloat(String(r.spend || 0).replace(/[^0-9.-]/g, ''));
      const m = parseFloat(String(r.mncs || 0).replace(/[^0-9.-]/g, ''));
      const p = parseFloat(String(r.payback || 0).replace(/[^0-9.-]/g, ''));
      const l = parseFloat(String(r.ltv || 0).replace(/[^0-9.-]/g, ''));
      spend += s;
      mncs += m;
      ltvSum += l * m;
      pbWeightedSum += p * m; 
    });
    return { spend, mncs, cpa: mncs > 0 ? spend / mncs : 0, payback: mncs > 0 ? pbWeightedSum / mncs : 0, ltv: mncs > 0 ? ltvSum / mncs : 0 };
  };

  const getContextKey = (region, month, platform) => `${region}_${month}_${platform}`;
  const availableMonths = useMemo(() => [...new Set(data.map(d => d.date).filter(Boolean))].sort().reverse(), [data]);

  const dashboardData = useMemo(() => {
    if (data.length === 0 || !selectedMonth) return {};
    const dashboards = {};
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const prevYearStr = `${year - 1}-${String(month).padStart(2, '0')}`;

    selectedPlatforms.forEach(p => {
      const shortName = PLATFORMS_MAP[p];
      const trend = availableMonths.slice().sort().map(m => {
        const monthData = data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === m && r.platform === shortName);
        return { month: m, ...aggregateData(monthData) };
      });

      const currentContextData = data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === selectedMonth && r.platform === shortName);
      const uniqueKeys = [...new Set(currentContextData.map(r => selectedRegion === 'GLOBAL' ? (r.region?.toUpperCase() || 'UNKNOWN') : (r.country || 'UNKNOWN')))];

      const contributionList = uniqueKeys.map(key => {
        const itemFilter = (r) => (selectedRegion === 'GLOBAL' ? r.region?.toUpperCase() : r.country) === key && r.platform === shortName;
        const curStats = aggregateData(data.filter(r => itemFilter(r) && r.date === selectedMonth));
        const prevMonthStats = aggregateData(data.filter(r => itemFilter(r) && r.date === prevMonthStr));
        const prevYearStats = aggregateData(data.filter(r => itemFilter(r) && r.date === prevYearStr));

        const calcChange = (cur, prev) => (prev && prev !== 0) ? (cur - prev) / prev : null;

        return {
          label: key,
          ...curStats,
          momChange: calcChange(curStats.mncs, prevMonthStats.mncs),
          yoyChange: calcChange(curStats.mncs, prevYearStats.mncs)
        };
      })
      .filter(item => item.spend > 0)
      .sort((a, b) => b.spend - a.spend);

      dashboards[p] = { trend, contributionList };
    });
    return dashboards;
  }, [data, selectedRegion, selectedMonth, selectedPlatforms, availableMonths]);

  const tableData = useMemo(() => {
    if (!selectedMonth || data.length === 0) return null;
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const cur = aggregateData(data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === selectedMonth && selectedPlatforms.some(p => PLATFORMS_MAP[p] === r.platform)));
    const prev = aggregateData(data.filter(r => (selectedRegion === 'GLOBAL' || r.region?.toUpperCase() === selectedRegion) && r.date === prevStr && selectedPlatforms.some(p => PLATFORMS_MAP[p] === r.platform)));
    const calcChange = (c, p) => (!p || p === 0) ? null : (c - p) / p;
    return { currentTotal: cur, mom: { spend: calcChange(cur.spend, prev.spend), mncs: calcChange(cur.mncs, prev.mncs), payback: calcChange(cur.payback, prev.payback) } };
  }, [data, selectedRegion, selectedMonth, selectedPlatforms]);

  const handleAutoGenerateCommentary = (p) => {
    const dash = dashboardData[p];
    if (!dash) return;
    const current = dash.trend.find(t => t.month === selectedMonth);
    if (!current) return;
    const sortedMonths = availableMonths.slice().sort();
    const currentIdx = sortedMonths.indexOf(selectedMonth);
    const prevMonth = currentIdx > 0 ? sortedMonths[currentIdx - 1] : null;
    const prevData = prevMonth ? dash.trend.find(t => t.month === prevMonth) : null;
    const mncDiff = prevData && prevData.mncs > 0 ? ((current.mncs - prevData.mncs) / prevData.mncs) * 100 : 0;
    
    const text = `${selectedMonth} analysis for ${p} in ${selectedRegion}:\nMonthly total reached ${new Intl.NumberFormat('en-US').format(current.mncs)} MNCs (${mncDiff >= 0 ? '+' : ''}${Math.round(mncDiff)}% MoM) at a ${current.payback.toFixed(1)}m MNC-weighted payback.\n\nContribution Summary:\n` + 
      dash.contributionList.slice(0, 3).map(c => `- ${c.label}: ${new Intl.NumberFormat('en-US').format(c.mncs)} MNCs, ${c.payback.toFixed(1)}m PB`).join('\n');
    
    setComments(prev => ({ ...prev, [getContextKey(selectedRegion, selectedMonth, p)]: text }));
  };

  const formatCurrency = (val) => val != null ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) : '-';
  const formatCPA = (val) => val != null ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : '-';
  const formatNumber = (val) => val != null ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val) : '-';
  const formatDecimal = (val) => val != null && val !== 0 ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(val) : '-';
  const formatChange = (val, inv = false) => {
    if (val == null) return <span className="text-slate-300">-</span>;
    const f = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' }).format(val);
    const good = (val > 0) !== inv;
    return <span className={`font-black px-2 py-0.5 rounded-full text-[10px] uppercase ${good ? 'text-green-700 bg-green-50 border border-green-200' : 'text-red-700 bg-red-50 border border-red-200'}`}>{f}</span>;
  };

  return (
    <div className="report-root bg-[#f8fafc] font-sans block relative overflow-visible h-auto min-h-screen">
      
      {/* COMMAND HEADER */}
      <nav className="w-full bg-[#1a3812] p-8 shadow-2xl flex flex-row items-center justify-between gap-10 border-b-[12px] border-green-900/30 no-print">
        <div className="flex items-center space-x-6">
          <div className="bg-white/10 p-3 rounded-[1rem] border border-white/10">
            <BarChart3 size={32} className="text-green-400 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter leading-none italic uppercase">Monthly report tool</h1>
            <p className="text-green-400/60 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Enterprise Performance Intel</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5">
          {!data.length ? (
            <div className="flex items-center gap-4">
              {isProcessing ? (
                <div className="flex items-center px-10 py-5 bg-white/10 text-white rounded-3xl font-black uppercase text-xs tracking-widest animate-pulse">
                   <Loader2 size={20} className="mr-3 animate-spin" /> Processing...
                </div>
              ) : (
                <label className="flex items-center px-10 py-5 bg-green-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest cursor-pointer hover:bg-green-500 transition-all shadow-xl">
                  <UploadCloud size={20} className="mr-3 w-5 h-5" /> Connect Data
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="flex items-center bg-white/10 p-2 rounded-3xl border border-white/10">
                 <select value={selectedMonth || ''} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-white font-black px-4 py-2 outline-none cursor-pointer text-xs uppercase tracking-widest">
                   {availableMonths.map(m => <option key={m} value={m} className="text-slate-900">{m}</option>)}
                 </select>
                 <div className="w-px h-6 bg-white/20 mx-3" />
                 <select value={selectedRegion || ''} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-transparent text-white font-black px-4 py-2 outline-none cursor-pointer text-xs uppercase tracking-widest">
                   {REGIONS.map(r => <option key={r} value={r} className="text-slate-900">{r}</option>)}
                 </select>
              </div>
              <button onClick={() => window.print()} className="flex items-center px-8 py-5 bg-white text-[#1a3812] rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-green-50 transition-all shadow-xl">
                 <Download size={18} className="mr-2 w-5 h-5 text-green-600" /> Export to PDF
              </button>
              <button onClick={() => {setData([]); setSelectedMonth('');}} className="p-4 bg-red-500/20 text-red-100 rounded-3xl hover:bg-red-600 transition-all">
                 <XCircle size={18} className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* DOCUMENT BODY */}
      <div className="report-content max-w-5xl mx-auto p-12 lg:p-16 overflow-visible h-auto block">
        {tableData ? (
          <div className="space-y-24 block overflow-visible animate-in fade-in duration-1000">
            <header className="flex flex-col border-l-[10px] border-green-600 pl-12 py-6 mb-16 overflow-visible">
                <h2 className="text-8xl lg:text-9xl font-black text-slate-900 tracking-tighter uppercase leading-[0.75]">
                   {selectedRegion} <span className="text-green-600 block underline decoration-green-100 decoration-[10px] underline-offset-[20px]">{selectedMonth}</span>
                </h2>
                <p className="text-slate-400 font-black uppercase tracking-[0.8em] mt-16 text-[11px]">Growth Synthesis Dossier</p>
            </header>

            <div className="flex flex-col md:flex-row gap-6 overflow-visible w-full">
              {[
                { label: 'Total Spend', value: formatCurrency(tableData.currentTotal.spend), change: tableData.mom.spend, inv: false },
                { label: 'Total MNCs', value: formatNumber(tableData.currentTotal.mncs), change: tableData.mom.mncs, inv: false },
                { label: 'Avg Payback', value: `${formatDecimal(tableData.currentTotal.payback)}m`, change: tableData.mom.payback, inv: true },
              ].map((kpi, idx) => (
                <div key={idx} className="flex-1 min-w-0 bg-white rounded-[3rem] p-10 border shadow-xl border-slate-50 flex flex-col justify-between hover:border-green-400 transition-all group overflow-visible">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-10">{kpi.label}</span>
                  <div className="flex flex-col gap-4 overflow-visible">
                    <span className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter leading-none group-hover:text-green-700 transition-colors break-all">
                       {kpi.value}
                    </span>
                    <div className="flex items-center gap-4 mt-2">
                      {formatChange(kpi.change, kpi.inv)}
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">vs prev period</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <section className="space-y-32 block overflow-visible h-auto">
              {selectedPlatforms.map(platform => {
                const contextKey = getContextKey(selectedRegion, selectedMonth, platform);
                return (
                  <PlatformDashboard
                    key={`dash-${platform}`}
                    title={platform}
                    dashboard={dashboardData[platform]}
                    formatCurrency={formatCurrency}
                    formatCPA={formatCPA}
                    formatNumber={formatNumber}
                    formatDecimal={formatDecimal}
                    commentary={comments[contextKey]}
                    roadmap={roadmaps[contextKey]}
                    onCommentChange={(p, t) => setComments(prev => ({ ...prev, [getContextKey(selectedRegion, selectedMonth, p)]: t }))}
                    onRoadmapChange={(p, t) => setRoadmaps(prev => ({ ...prev, [getContextKey(selectedRegion, selectedMonth, p)]: t }))}
                    onAutoGenerate={handleAutoGenerateCommentary}
                    isGlobal={selectedRegion === 'GLOBAL'}
                  />
                );
              })}
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center no-print">
            <div className="bg-white p-24 rounded-[5rem] shadow-2xl border border-slate-50 max-w-3xl">
              <BarChart3 size={96} className="text-green-600 mx-auto mb-10 transform -rotate-12 w-24 h-24" />
              <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-8 uppercase leading-none">Intelligence Hub</h3>
              <p className="text-slate-400 font-bold mb-12 text-xl uppercase tracking-tight leading-relaxed max-w-xl mx-auto">
                 Connect your <span className="text-slate-900 underline decoration-green-500 decoration-8">CSV marketing source</span> to generate the performance dossier.
              </p>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root {
          height: auto !important;
          min-height: 100% !important;
          overflow: visible !important;
          display: block !important;
          position: static !important;
          width: 100% !important;
          background: #f8fafc !important;
        }

        .chart-component-svg {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        
        svg:not(.chart-component-svg) {
          width: 20px !important;
          height: 20px !important;
          display: inline-block;
          vertical-align: middle;
        }

        .no-print { display: block; }
        @media print { 
          .no-print { display: none !important; }
          .report-content { max-width: 100% !important; width: 100% !important; padding: 0 !important; }
        }
      `}} />
    </div>
  );
}