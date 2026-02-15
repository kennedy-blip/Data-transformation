import { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  Upload, FileSpreadsheet, Filter, Calculator, Table, 
  BarChart3, Download, Plus, X, ChevronDown, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown,
  Code, Database, FileText, RefreshCw,
  AlertCircle, Grid3X3, Sparkles
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { cn } from './utils/cn';
import _ from 'lodash';

type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'empty';

interface ColumnInfo {
  name: string;
  type: ColumnType;
  missing: number;
  unique: number;
  min?: number | string;
  max?: number | string;
}

interface DataRow {
  [key: string]: any;
}

interface FilterConfig {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';
  value: string;
  value2?: string;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

interface AggregationConfig {
  column: string;
  operation: 'sum' | 'mean' | 'median' | 'count' | 'min' | 'max' | 'std';
  groupBy?: string[];
}

interface FormulaConfig {
  name: string;
  formula: string;
}

interface PivotConfig {
  rows: string[];
  columns: string[];
  values: string[];
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
}

function detectColumnType(values: any[]): ColumnType {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'empty';
  
  const sample = nonEmpty.slice(0, 100);
  
  const isNumber = sample.every(v => !isNaN(Number(v)) && v !== '');
  if (isNumber) return 'number';
  
  const isBoolean = sample.every(v => 
    typeof v === 'boolean' || 
    ['true', 'false', '1', '0', 'yes', 'no'].includes(String(v).toLowerCase())
  );
  if (isBoolean) return 'boolean';
  
  const isDate = sample.every(v => !isNaN(Date.parse(v)));
  if (isDate) return 'date';
  
  return 'string';
}

function getColumnStats(data: DataRow[], column: string): ColumnInfo {
  const values = data.map(row => row[column]);
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  const uniqueValues = [...new Set(nonEmpty.map(String))];
  const type = detectColumnType(nonEmpty);
  
  const info: ColumnInfo = {
    name: column,
    type,
    missing: values.length - nonEmpty.length,
    unique: uniqueValues.length,
  };
  
  if (type === 'number') {
    const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
    if (nums.length > 0) {
      info.min = Math.min(...nums);
      info.max = Math.max(...nums);
    }
  } else if (type === 'string' || type === 'date') {
    info.min = _.min(nonEmpty.map(String)) || '';
    info.max = _.max(nonEmpty.map(String)) || '';
  }
  
  return info;
}

export function App() {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [columnStats, setColumnStats] = useState<ColumnInfo[]>([]);
  const [transformedData, setTransformedData] = useState<DataRow[]>([]);
  const [activeTab, setActiveTab] = useState<'raw' | 'transformed' | 'side-by-side'>('raw');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [isDragging, setIsDragging] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);
  
  // Aggregation
  const [aggregation, setAggregation] = useState<AggregationConfig | null>(null);
  const [showAggregationPanel, setShowAggregationPanel] = useState(false);
  
  // Pivot
  const [pivotConfig, setPivotConfig] = useState<PivotConfig | null>(null);
  const [showPivotPanel, setShowPivotPanel] = useState(false);
  
  // Formula
  const [formulas, setFormulas] = useState<FormulaConfig[]>([]);
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);
  const [newFormulaName, setNewFormulaName] = useState('');
  const [newFormulaText, setNewFormulaText] = useState('');
  const [formulaError, setFormulaError] = useState('');
  
  // Export
  const [showExportPanel, setShowExportPanel] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as DataRow[];
          const cols = Object.keys(data[0] || {});
          setRawData(data);
          setColumns(cols);
          setColumnStats(cols.map(c => getColumnStats(data, c)));
          setTransformedData(data);
        }
      });
    } else if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as DataRow[];
          const flatData = Array.isArray(data) ? data : [data];
          const cols = Object.keys(flatData[0] || {});
          setRawData(flatData);
          setColumns(cols);
          setColumnStats(cols.map(c => getColumnStats(flatData, c)));
          setTransformedData(flatData);
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as DataRow[];
          const cols = Object.keys(jsonData[0] || {});
          setRawData(jsonData);
          setColumns(cols);
          setColumnStats(cols.map(c => getColumnStats(jsonData, c)));
          setTransformedData(jsonData);
        } catch (err) {
          alert('Invalid Excel file');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const applyTransformations = useCallback(() => {
    let data = [...rawData];
    
    // Apply filters
    filters.forEach(filter => {
      data = data.filter(row => {
        const value = row[filter.column];
        const strValue = String(value).toLowerCase();
        const filterValue = filter.value.toLowerCase();
        const filterValue2 = filter.value2?.toLowerCase();
        
        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === filterValue;
          case 'contains':
            return strValue.includes(filterValue);
          case 'startsWith':
            return strValue.startsWith(filterValue);
          case 'endsWith':
            return strValue.endsWith(filterValue);
          case 'gt':
            return Number(value) > Number(filterValue);
          case 'lt':
            return Number(value) < Number(filterValue);
          case 'gte':
            return Number(value) >= Number(filterValue);
          case 'lte':
            return Number(value) <= Number(filterValue);
          case 'between':
            const num = Number(value);
            return num >= Number(filterValue) && num <= Number(filterValue2);
          case 'isEmpty':
            return !value || value === '' || value === null || value === undefined;
          case 'isNotEmpty':
            return value && value !== '' && value !== null && value !== undefined;
          default:
            return true;
        }
      });
    });
    
    // Apply sorting
    if (sortConfig.length > 0) {
      data.sort((a, b) => {
        for (const sort of sortConfig) {
          const aVal = a[sort.column];
          const bVal = b[sort.column];
          const comparison = typeof aVal === 'number' && typeof bVal === 'number'
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal));
          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    }
    
    // Apply aggregation
    if (aggregation) {
      const grouped = _.groupBy(data, aggregation.column);
      const aggData = Object.entries(grouped).map(([key, rows]) => {
        const values = rows.map(r => Number(r[aggregation.column])).filter(n => !isNaN(n));
        let result: any = { [aggregation.column]: key, _count: rows.length };
        
        switch (aggregation.operation) {
          case 'sum':
            result._value = _.sum(values);
            break;
          case 'mean':
            result._value = _.mean(values);
            break;
          case 'median':
            result._value = _.sortBy(values)[Math.floor(values.length / 2)];
            break;
          case 'count':
            result._value = rows.length;
            break;
          case 'min':
            result._value = _.min(values);
            break;
          case 'max':
            result._value = _.max(values);
            break;
        }
        return result;
      });
      data = aggData;
    }
    
    // Apply pivot
    if (pivotConfig && pivotConfig.rows.length > 0 && pivotConfig.values.length > 0) {
      const grouped = _.groupBy(data, (row: DataRow) => 
        pivotConfig.rows.map(r => row[r]).join('::')
      );
      const pivotData = Object.entries(grouped).map(([key, rows]) => {
        const row: DataRow = {};
        pivotConfig.rows.forEach((r, i) => {
          const parts = key.split('::');
          row[r] = parts[i];
        });
        
        pivotConfig.values.forEach(val => {
          const values = rows.map(r => Number(r[val])).filter(n => !isNaN(n));
          switch (pivotConfig.aggregation) {
            case 'sum':
              row[`${val}_sum`] = _.sum(values);
              break;
            case 'count':
              row[`${val}_count`] = values.length;
              break;
            case 'avg':
              row[`${val}_avg`] = _.mean(values);
              break;
            case 'min':
              row[`${val}_min`] = _.min(values);
              break;
            case 'max':
              row[`${val}_max`] = _.max(values);
              break;
          }
        });
        
        return row;
      });
      data = pivotData;
    }
    
    // Apply formulas
    formulas.forEach(formula => {
      data = data.map((row, idx) => {
        try {
          let result: any;
          const formulaStr = formula.formula
            .replace(/SUM\(([^)]+)\)/gi, (_, cols) => {
              const col = (cols as string).trim();
              const values = data.slice(0, idx + 1).map(r => Number(r[col])).filter(n => !isNaN(n));
              return String(values.reduce((a: number, b: number) => a + b, 0));
            })
            .replace(/AVG\(([^)]+)\)/gi, (_, cols) => {
              const col = (cols as string).trim();
              const values = data.slice(0, idx + 1).map(r => Number(r[col])).filter(n => !isNaN(n));
              return String(values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0);
            })
            .replace(/LEN\(([^)]+)\)/gi, (_, cols) => {
              const col = (cols as string).trim();
              return String(String(row[col] || '').length);
            })
            .replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, trueVal, falseVal) => {
              try {
                const condition = cond.replace(/([A-Za-z_]+)\s*(&gt;=|&lt;=|&gt;|&lt;|=|==|!=)\s*([0-9.]+)/g, (_: string, col: string, op: string, val: string) => {
                  const rowVal = Number(row[col.trim()]);
                  const compVal = Number(val);
                  let res: boolean;
                  switch (op) {
                    case '&gt;': res = rowVal > compVal; break;
                    case '&lt;': res = rowVal < compVal; break;
                    case '&gt;=': res = rowVal >= compVal; break;
                    case '&lt;=': res = rowVal <= compVal; break;
                    case '=':
                    case '==': res = rowVal === compVal; break;
                    case '!=': res = rowVal !== compVal; break;
                    default: res = false;
                  }
                  return String(res);
                });
                return eval(condition) ? String(trueVal).trim() : String(falseVal).trim();
              } catch {
                return String(falseVal).trim();
              }
            })
            .replace(/ROW\(\)/g, String(idx + 1));
          
          // Simple column reference evaluation
          columns.forEach(col => {
            const regex = new RegExp(`\\b${col}\\b`, 'g');
            formulaStr.replace(regex, `'${row[col]}'`);
          });
          
          // Evaluate simple expressions
          const evalStr = formulaStr.replace(/([A-Za-z_]+)/g, (_, name) => {
            if (row[name] !== undefined) {
              return typeof row[name] === 'string' ? `'${row[name]}'` : row[name];
            }
            return name;
          });
          
          try {
            result = eval(evalStr);
          } catch {
            result = null;
          }
          
          return { ...row, [formula.name]: result };
        } catch (err) {
          return { ...row, [formula.name]: null };
        }
      });
    });
    
    setTransformedData(data);
  }, [rawData, filters, sortConfig, aggregation, pivotConfig, formulas, columns]);

  // Auto-apply transformations when dependencies change
  useMemo(() => {
    if (rawData.length > 0) {
      applyTransformations();
    }
  }, [rawData, filters, sortConfig, aggregation, pivotConfig, formulas]);

  const addFilter = () => {
    if (columns.length > 0) {
      setFilters([...filters, { column: columns[0], operator: 'contains', value: '' }]);
    }
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterConfig>) => {
    setFilters(filters.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const toggleSort = (column: string) => {
    const existing = sortConfig.find(s => s.column === column);
    if (existing) {
      if (existing.direction === 'asc') {
        setSortConfig(sortConfig.map(s => s.column === column ? { ...s, direction: 'desc' } : s));
      } else {
        setSortConfig(sortConfig.filter(s => s.column !== column));
      }
    } else {
      setSortConfig([...sortConfig, { column, direction: 'asc' }]);
    }
  };

  const getSortIcon = (column: string) => {
    const sort = sortConfig.find(s => s.column === column);
    if (!sort) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return sort.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-indigo-600" />
      : <ArrowDown className="w-4 h-4 text-indigo-600" />;
  };

  const applyFormula = () => {
    if (!newFormulaName || !newFormulaText) {
      setFormulaError('Please enter both formula name and expression');
      return;
    }
    
    if (formulas.some(f => f.name === newFormulaName)) {
      setFormulaError('Formula name already exists');
      return;
    }
    
    setFormulas([...formulas, { name: newFormulaName, formula: newFormulaText }]);
    setNewFormulaName('');
    setNewFormulaText('');
    setFormulaError('');
  };

  const removeFormula = (name: string) => {
    setFormulas(formulas.filter(f => f.name !== name));
  };

  const generateSQL = () => {
    const tableName = 'transformed_data';
    let sql = `-- SQL Query for transformed data\n`;
    sql += `CREATE TABLE ${tableName} (\n`;
    const cols = Object.keys(transformedData[0] || {});
    sql += cols.map(c => `  ${c.replace(/\s+/g, '_')} TEXT`).join(',\n');
    sql += `\n);\n\n`;
    sql += `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES\n`;
    sql += transformedData.map(row => {
      const values = cols.map(c => {
        const val = row[c];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(', ');
      return `(${values})`;
    }).join(',\n');
    sql += ';';
    
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
  };

  const generatePython = () => {
    const code = `# Python/Pandas script for data transformation
import pandas as pd
import json

# Sample data (${transformedData.length} rows)
data = ${JSON.stringify(transformedData, null, 2)}

df = pd.DataFrame(data)

# Applied filters: ${filters.length > 0 ? filters.map(f => `${f.column} ${f.operator} "${f.value}"`).join(', ') : 'None'}
# Applied sorting: ${sortConfig.length > 0 ? sortConfig.map(s => `${s.column} ${s.direction}`).join(', ') : 'None'}
# Applied aggregation: ${aggregation ? `${aggregation.operation}(${aggregation.column})` : 'None'}
# Applied pivot: ${pivotConfig ? `rows=${pivotConfig.rows}, columns=${pivotConfig.columns}, values=${pivotConfig.values}` : 'None'}
# Applied formulas: ${formulas.map(f => f.name).join(', ') || 'None'}

# Display first few rows
print(df.head())

# Basic statistics
print("\\nData types:")
print(df.dtypes)

print("\\nSummary statistics:")
print(df.describe())

# Export to CSV
df.to_csv('output.csv', index=False)
print("\\nData exported to output.csv")
`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transform_data.py';
    a.click();
  };

  const exportCSV = () => {
    const csv = Papa.unparse(transformedData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transformed_data.csv';
    a.click();
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(transformedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'transformed_data.xlsx');
  };

  const getCurrentData = () => {
    return activeTab === 'raw' ? rawData : transformedData;
  };

  const chartData = useMemo(() => {
    const data = transformedData.slice(0, 20);
    if (columns.length < 2) return [];
    
    const numCol = columns.find(c => columnStats.find(cs => cs.name === c && cs.type === 'number'));
    const catCol = columns[0];
    
    if (!numCol) return [];
    
    return data.map(row => ({
      name: String(row[catCol] || '').substring(0, 20),
      value: Number(row[numCol]) || 0,
    }));
  }, [transformedData, columns, columnStats]);

  const renderFileUpload = () => (
    <div 
      className={cn(
        "border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200",
        isDragging 
          ? "border-indigo-500 bg-indigo-50" 
          : "border-gray-300 hover:border-indigo-400 bg-gray-50"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <Upload className="h-8 w-8 text-indigo-600" />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-900">Drop your file here</p>
          <p className="text-sm text-gray-500 mt-1">Supports CSV, Excel (.xlsx, .xls), JSON</p>
        </div>
        <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors">
          Browse Files
          <input 
            type="file" 
            className="hidden" 
            accept=".csv,.xlsx,.xls,.json"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );

  const renderDataTable = (data: DataRow[], highlightChanges = false) => {
    const cols = Object.keys(data[0] || {});
    
    return (
      <div className="overflow-auto max-h-[500px] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {cols.map(col => (
                <th 
                  key={col}
                  className="px-4 py-3 text-left font-semibold text-gray-700 border-b bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort(col)}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[150px]">{col}</span>
                    {getSortIcon(col)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr 
                key={idx} 
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  highlightChanges && rawData[idx] && JSON.stringify(row) !== JSON.stringify(rawData[idx]) 
                    ? "bg-yellow-50" 
                    : ''
                )}
              >
                {cols.map(col => (
                  <td key={col} className="px-4 py-2 border-b text-gray-600 truncate max-w-[200px]">
                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-gray-400 italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStatsPanel = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {columnStats.slice(0, 6).map(stat => (
        <div key={stat.name} className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900 truncate">{stat.name}</h4>
            <span className={cn(
              "text-xs px-2 py-1 rounded-full",
              stat.type === 'number' ? 'bg-blue-100 text-blue-700' :
              stat.type === 'string' ? 'bg-green-100 text-green-700' :
              stat.type === 'date' ? 'bg-purple-100 text-purple-700' :
              stat.type === 'boolean' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-700'
            )}>
              {stat.type}
            </span>
          </div>
          <div className="space-y-1 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Missing:</span>
              <span className={stat.missing > 0 ? 'text-red-500' : 'text-green-500'}>{stat.missing}</span>
            </div>
            <div className="flex justify-between">
              <span>Unique:</span>
              <span>{stat.unique}</span>
            </div>
            {stat.min !== undefined && (
              <div className="flex justify-between">
                <span>Range:</span>
                <span>{String(stat.min).substring(0, 10)} - {String(stat.max).substring(0, 10)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderFilterPanel = () => (
    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filters
        </h3>
        <button onClick={addFilter} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Filter
        </button>
      </div>
      
      {filters.length === 0 ? (
        <p className="text-sm text-gray-500">No filters applied. Click "Add Filter" to start.</p>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <select 
                value={filter.column}
                onChange={(e) => updateFilter(idx, { column: e.target.value })}
                className="px-2 py-1 border rounded text-sm"
              >
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={filter.operator}
                onChange={(e) => updateFilter(idx, { operator: e.target.value as FilterConfig['operator'] })}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="equals">equals</option>
                <option value="contains">contains</option>
                <option value="startsWith">starts with</option>
                <option value="endsWith">ends with</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
                              <option value="gte">{'≥'}</option>
              <option value="lte">{'≤'}</option>
                <option value="between">between</option>
                <option value="isEmpty">is empty</option>
                <option value="isNotEmpty">is not empty</option>
              </select>
              {!['isEmpty', 'isNotEmpty'].includes(filter.operator) && (
                <>
                  <input 
                    type="text" 
                    value={filter.value}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder="Value"
                    className="px-2 py-1 border rounded text-sm w-32"
                  />
                  {filter.operator === 'between' && (
                    <input 
                      type="text" 
                      value={filter.value2 || ''}
                      onChange={(e) => updateFilter(idx, { value2: e.target.value })}
                      placeholder="Value 2"
                      className="px-2 py-1 border rounded text-sm w-32"
                    />
                  )}
                </>
              )}
              <button onClick={() => removeFilter(idx)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAggregationPanel = () => (
    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Calculator className="w-4 h-4" /> Aggregation
      </h3>
      
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-600">Column</label>
          <select 
            value={aggregation?.column || ''}
            onChange={(e) => setAggregation(e.target.value ? { column: e.target.value, operation: 'sum' } : null)}
            className="w-full px-2 py-1 border rounded text-sm mt-1"
          >
            <option value="">Select column</option>
            {columns.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        {aggregation && (
          <div>
            <label className="text-sm text-gray-600">Operation</label>
            <select 
              value={aggregation.operation}
              onChange={(e) => setAggregation({ ...aggregation, operation: e.target.value as AggregationConfig['operation'] })}
              className="w-full px-2 py-1 border rounded text-sm mt-1"
            >
              <option value="sum">Sum</option>
              <option value="mean">Average</option>
              <option value="median">Median</option>
              <option value="count">Count</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </div>
        )}
        
        {aggregation && (
          <button 
            onClick={() => setAggregation(null)}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear aggregation
          </button>
        )}
      </div>
    </div>
  );

  const renderPivotPanel = () => {
    const numCols = columns.filter(c => columnStats.find(cs => cs.name === c && cs.type === 'number'));
    const catCols = columns.filter(c => !numCols.includes(c));
    
    return (
      <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" /> Pivot Table
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Row Labels</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {catCols.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    const current = pivotConfig?.rows || [];
                    const newRows = current.includes(c) 
                      ? current.filter(r => r !== c)
                      : [...current, c];
                    setPivotConfig(pivotConfig ? { ...pivotConfig, rows: newRows } : { rows: newRows, columns: [], values: [], aggregation: 'sum' });
                  }}
                  className={cn(
                    "px-2 py-1 text-sm rounded border",
                    pivotConfig?.rows.includes(c) 
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700" 
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-600">Values</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {numCols.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    const current = pivotConfig?.values || [];
                    const newValues = current.includes(c)
                      ? current.filter(v => v !== c)
                      : [...current, c];
                    setPivotConfig(pivotConfig ? { ...pivotConfig, values: newValues } : { rows: [], columns: [], values: newValues, aggregation: 'sum' });
                  }}
                  className={cn(
                    "px-2 py-1 text-sm rounded border",
                    pivotConfig?.values.includes(c)
                      ? "bg-green-100 border-green-300 text-green-700"
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          
          {pivotConfig && pivotConfig.values.length > 0 && (
            <div>
              <label className="text-sm text-gray-600">Aggregation</label>
              <select
                value={pivotConfig.aggregation}
                onChange={(e) => setPivotConfig({ ...pivotConfig, aggregation: e.target.value as PivotConfig['aggregation'] })}
                className="w-full px-2 py-1 border rounded text-sm mt-1"
              >
                <option value="sum">Sum</option>
                <option value="count">Count</option>
                <option value="avg">Average</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            </div>
          )}
          
          {pivotConfig && (
            <button 
              onClick={() => setPivotConfig(null)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear pivot
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderFormulaPanel = () => {
    const suggestions = [
      { name: 'SUM(column)', desc: 'Sum of values in column' },
      { name: 'AVG(column)', desc: 'Average of column values' },
      { name: 'LEN(column)', desc: 'Length of text in column' },
      { name: 'IF(condition, true_val, false_val)', desc: 'Conditional expression' },
      { name: 'ROW()', desc: 'Current row number' },
    ];
    
    return (
      <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Formula Builder
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">New Column Name</label>
            <input 
              type="text"
              value={newFormulaName}
              onChange={(e) => setNewFormulaName(e.target.value)}
              placeholder="e.g., total_price"
              className="w-full px-2 py-1 border rounded text-sm mt-1"
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-600">Formula</label>
            <textarea 
              value={newFormulaText}
              onChange={(e) => setNewFormulaText(e.target.value)}
              placeholder="e.g., SUM(price) * 1.1"
              className="w-full px-2 py-1 border rounded text-sm mt-1 font-mono"
              rows={2}
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Quick Functions</label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s.name}
                  onClick={() => setNewFormulaText(s.name)}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                  title={s.desc}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          
          {formulaError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> {formulaError}
            </p>
          )}
          
          <button 
            onClick={applyFormula}
            className="w-full px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
          >
            Apply Formula
          </button>
        </div>
        
        {formulas.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Applied Formulas</h4>
            <div className="space-y-2">
              {formulas.map(f => (
                <div key={f.name} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                  <div>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-gray-500 ml-2 font-mono text-xs">{f.formula}</span>
                  </div>
                  <button onClick={() => removeFormula(f.name)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderExportPanel = () => (
    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Download className="w-4 h-4" /> Export Options
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={exportCSV}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileText className="w-5 h-5" /> CSV
        </button>
        
        <button 
          onClick={exportExcel}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <FileSpreadsheet className="w-5 h-5" /> Excel
        </button>
        
        <button 
          onClick={generateSQL}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Database className="w-5 h-5" /> SQL
        </button>
        
        <button 
          onClick={generatePython}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Code className="w-5 h-5" /> Python
        </button>
      </div>
      
      <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-auto max-h-32">
        <p className="text-gray-500 mb-2">Preview ({transformedData.length} rows, {Object.keys(transformedData[0] || {}).length} columns)</p>
        {JSON.stringify(transformedData[0], null, 2)?.substring(0, 200)}...
      </div>
    </div>
  );

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-gray-500">
          <p>No numeric data available for charting</p>
        </div>
      );
    }
    
    return (
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (rawData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">DataForge</h1>
              <p className="text-xs text-gray-500">Upload & Transform Your Data</p>
            </div>
          </div>
        </header>
        
        <main className="max-w-3xl mx-auto px-6 py-16">
          {renderFileUpload()}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">DataForge</h1>
              <p className="text-xs text-gray-500">
                {rawData.length} rows • {columns.length} columns
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('raw')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === 'raw' ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Raw
              </button>
              <button
                onClick={() => setActiveTab('transformed')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === 'transformed' ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Transformed
              </button>
              <button
                onClick={() => setActiveTab('side-by-side')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === 'side-by-side' ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Side by Side
              </button>
            </div>
            
            <button
              onClick={() => setShowExportPanel(!showExportPanel)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                showExportPanel ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Download className="w-4 h-4" /> Export
            </button>
            
            <button
              onClick={() => {
                setRawData([]);
                setTransformedData([]);
                setColumns([]);
                setFilters([]);
                setSortConfig([]);
                setAggregation(null);
                setPivotConfig(null);
                setFormulas([]);
              }}
              className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-white p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-80px)]">
          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
            {renderStatsPanel()}
          </div>
          
          {/* Filter Panel */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="w-full flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Filter className="w-4 h-4" /> Filters
              {filters.length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                  {filters.length}
                </span>
              )}
            </span>
            {showFilterPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showFilterPanel && renderFilterPanel()}
          
          {/* Aggregation Panel */}
          <button
            onClick={() => setShowAggregationPanel(!showAggregationPanel)}
            className="w-full flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Calculator className="w-4 h-4" /> Aggregation
              {aggregation && (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </span>
            {showAggregationPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showAggregationPanel && renderAggregationPanel()}
          
          {/* Pivot Panel */}
          <button
            onClick={() => setShowPivotPanel(!showPivotPanel)}
            className="w-full flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Grid3X3 className="w-4 h-4" /> Pivot Table
              {pivotConfig && pivotConfig.rows.length > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </span>
            {showPivotPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showPivotPanel && renderPivotPanel()}
          
          {/* Formula Panel */}
          <button
            onClick={() => setShowFormulaPanel(!showFormulaPanel)}
            className="w-full flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 font-medium text-gray-700">
              <Sparkles className="w-4 h-4" /> Formula Builder
              {formulas.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                  {formulas.length}
                </span>
              )}
            </span>
            {showFormulaPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showFormulaPanel && renderFormulaPanel()}
          
          {/* Export Panel */}
          {showExportPanel && renderExportPanel()}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  viewMode === 'table' ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Table className="w-4 h-4" /> Table
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  viewMode === 'chart' ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <BarChart3 className="w-4 h-4" /> Chart
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              {activeTab === 'raw' && `Showing ${rawData.length} rows`}
              {activeTab === 'transformed' && `Showing ${transformedData.length} rows`}
              {activeTab === 'side-by-side' && `Comparing ${rawData.length} → ${transformedData.length} rows`}
            </div>
          </div>
          
          {/* Content */}
          {viewMode === 'table' ? (
            activeTab === 'side-by-side' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Raw Data
                  </h3>
                  {renderDataTable(rawData)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Transformed Data
                  </h3>
                  {renderDataTable(transformedData, true)}
                </div>
              </div>
            ) : (
              renderDataTable(getCurrentData())
            )
          ) : (
            renderChart()
          )}
        </main>
      </div>
    </div>
  );
}
