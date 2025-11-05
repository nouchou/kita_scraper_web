import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Play, Pause, StopCircle, AlertCircle, Loader, Settings, Database, XCircle, BarChart3, PieChart, TrendingUp, Search, Filter, Calendar, MapPin, Building2, Phone, Mail, Globe, ChevronDown, ChevronUp, Trash2, Save } from 'lucide-react';
import { BarChart, Bar, PieChart as RechartsPie, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const KitaScraperApp = () => {
  const [activeTab, setActiveTab] = useState('scraper'); // scraper, dashboard, data, history
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [currentTask, setCurrentTask] = useState('');
  const [scrapedData, setScrapedData] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({ cities: 0, kitas: 0, errors: 0 });
  const [settings, setSettings] = useState({
    delay: 500,
    maxRetries: 3,
    timeout: 30000
  });
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [historyData, setHistoryData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  
  const logsEndRef = useRef(null);
  const statusRef = useRef('idle');

  const states = [
    'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
    'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'
  ];

  const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1'];

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Charger l'historique au démarrage
  useEffect(() => {
    const savedHistory = localStorage.getItem('kita_scraping_history');
    if (savedHistory) {
      setHistoryData(JSON.parse(savedHistory));
    }
  }, []);

  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp, id: Date.now() + Math.random() }]);
  }, []);

  const saveToHistory = (data) => {
    const historyEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      states: selectedStates,
      totalKitas: data.length,
      totalCities: stats.cities,
      errors: stats.errors,
      duration: '5m 32s', // À calculer en production
      data: data
    };
    
    const newHistory = [historyEntry, ...historyData].slice(0, 10); // Garder les 10 derniers
    setHistoryData(newHistory);
    localStorage.setItem('kita_scraping_history', JSON.stringify(newHistory));
  };

  const toggleState = (state) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const selectAllStates = () => setSelectedStates([...states]);
  const deselectAllStates = () => setSelectedStates([]);

  const startScraping = async () => {
    if (selectedStates.length === 0) {
      setErrorMessage('Veuillez sélectionner au moins un État');
      return;
    }

    setStatus('running');
    setProgress(0);
    setLogs([]);
    setScrapedData([]);
    setErrorMessage('');
    setStats({ cities: 0, kitas: 0, errors: 0 });

    addLog('🚀 Démarrage du scraping...', 'info');
    addLog(`📋 États sélectionnés: ${selectedStates.join(', ')}`, 'info');

    await simulateScraping();
  };

  const simulateScraping = async () => {
    const totalSteps = selectedStates.length * 4;
    let currentStep = 0;
    const allData = [];

    for (let i = 0; i < selectedStates.length; i++) {
      if (statusRef.current === 'stopped') break;
      
      const state = selectedStates[i];
      addLog(`\n📂 Traitement de ${state}...`, 'info');

      const mockCities = ['Stadt A', 'Stadt B', 'Stadt C', 'Stadt D'];
      
      for (let j = 0; j < mockCities.length; j++) {
        if (statusRef.current === 'stopped') break;
        
        while (statusRef.current === 'paused') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const city = mockCities[j];
        setCurrentTask(`${state} → ${city}`);
        addLog(`  🏙️ Scraping de ${city}...`, 'info');

        await new Promise(resolve => setTimeout(resolve, settings.delay + Math.random() * 500));

        const numKitas = Math.floor(Math.random() * 8) + 3;
        const mockKitas = Array.from({ length: numKitas }, (_, k) => ({
          id: `${Date.now()}-${i}-${j}-${k}`,
          name: `Kita ${city} ${k + 1}`,
          street_address: `${['Hauptstraße', 'Bahnhofstraße', 'Schulstraße', 'Parkweg'][k % 4]} ${Math.floor(Math.random() * 100) + 1}`,
          postal_code: `${10000 + Math.floor(Math.random() * 90000)}`,
          city: city,
          state: state,
          phone: `+49 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 90000) + 10000}`,
          email: `kontakt@kita-${city.toLowerCase().replace(/\s/g, '')}-${k + 1}.de`,
          website: `www.kita-${city.toLowerCase().replace(/\s/g, '')}-${k + 1}.de`,
          capacity: Math.floor(Math.random() * 100) + 20,
          ageRange: ['0-3 Jahre', '3-6 Jahre', '0-6 Jahre'][Math.floor(Math.random() * 3)]
        }));

        allData.push(...mockKitas);
        setScrapedData(prev => [...prev, ...mockKitas]);
        setStats(prev => ({
          cities: prev.cities + 1,
          kitas: prev.kitas + numKitas,
          errors: prev.errors + (Math.random() > 0.9 ? 1 : 0)
        }));

        addLog(`  ✅ ${numKitas} kitas trouvées dans ${city}`, 'success');

        currentStep++;
        setProgress((currentStep / totalSteps) * 100);
      }

      addLog(`✅ ${state} terminé`, 'success');
    }

    if (statusRef.current !== 'stopped') {
      setStatus('completed');
      setCurrentTask('');
      addLog('\n🎉 Scraping terminé avec succès!', 'success');
      
      setStats(finalStats => {
        addLog(`📊 Total: ${finalStats.kitas} kitas dans ${finalStats.cities} villes`, 'info');
        saveToHistory(allData);
        return finalStats;
      });
    }
  };

  const pauseScraping = () => {
    setStatus('paused');
    addLog('⏸️ Scraping mis en pause', 'warning');
  };

  const resumeScraping = () => {
    setStatus('running');
    addLog('▶️ Scraping repris', 'info');
  };

  const stopScraping = () => {
    setStatus('stopped');
    addLog('⏹️ Scraping arrêté par l\'utilisateur', 'warning');
    setCurrentTask('');
  };

  const downloadExcel = () => {
    const headers = ['ID', 'Name', 'Street Address', 'Postal Code', 'City', 'State', 'Phone', 'Email', 'Website', 'Capacity', 'Age Range'];
    const csvContent = [
      headers.join(','),
      ...scrapedData.map(row => 
        [row.id, row.name, row.street_address, row.postal_code, row.city, row.state, row.phone || '', row.email || '', row.website || '', row.capacity || '', row.ageRange || '']
          .map(cell => `"${cell}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kitas_${new Date().toISOString().split('T')[0]}_${scrapedData.length}.csv`;
    link.click();
    
    addLog(`💾 Fichier téléchargé: ${scrapedData.length} entrées`, 'success');
  };

  const downloadJSON = () => {
    const jsonContent = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kitas_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    addLog(`💾 Fichier JSON téléchargé`, 'success');
  };

  const clearLogs = () => setLogs([]);

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      default: return 'text-gray-300';
    }
  };

  // Données pour les graphiques
  const getChartData = () => {
    const stateCount = {};
    scrapedData.forEach(kita => {
      stateCount[kita.state] = (stateCount[kita.state] || 0) + 1;
    });
    return Object.entries(stateCount).map(([name, value]) => ({ name, value }));
  };

  const getCityDistribution = () => {
    const cityCount = {};
    scrapedData.forEach(kita => {
      cityCount[kita.city] = (cityCount[kita.city] || 0) + 1;
    });
    return Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  };

  // Filtrer et trier les données
  const getFilteredData = () => {
    let filtered = scrapedData;
    
    if (searchTerm) {
      filtered = filtered.filter(kita => 
        kita.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kita.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kita.street_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterState !== 'all') {
      filtered = filtered.filter(kita => kita.state === filterState);
    }
    
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'city') return a.city.localeCompare(b.city);
      if (sortBy === 'state') return a.state.localeCompare(b.state);
      return 0;
    });
    
    return filtered;
  };

  const deleteHistoryItem = (id) => {
    const newHistory = historyData.filter(item => item.id !== id);
    setHistoryData(newHistory);
    localStorage.setItem('kita_scraping_history', JSON.stringify(newHistory));
  };

  const loadHistoryData = (historyItem) => {
    setScrapedData(historyItem.data);
    setStats({
      cities: historyItem.totalCities,
      kitas: historyItem.totalKitas,
      errors: historyItem.errors
    });
    setActiveTab('data');
    addLog(`📂 Données chargées depuis l'historique (${historyItem.totalKitas} kitas)`, 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                🎓 Application de Web Scraping & Visualisation
              </h1>
              <p className="text-purple-100">
                Extraction et analyse intelligente des données Kita en Allemagne
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg transition"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-xl mb-6 p-2 flex gap-2 overflow-x-auto">
          {[
            { id: 'scraper', icon: Database, label: 'Web Scraper' },
            { id: 'dashboard', icon: BarChart3, label: 'Tableau de Bord' },
            { id: 'data', icon: Filter, label: 'Données Extraites' },
            { id: 'history', icon: Calendar, label: 'Historique' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">⚙️ Paramètres avancés</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Délai entre requêtes (ms)
                </label>
                <input
                  type="number"
                  value={settings.delay}
                  onChange={(e) => setSettings({...settings, delay: parseInt(e.target.value) || 500})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="100"
                  max="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de tentatives max
                </label>
                <input
                  type="number"
                  value={settings.maxRetries}
                  onChange={(e) => setSettings({...settings, maxRetries: parseInt(e.target.value) || 3})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={settings.timeout}
                  onChange={(e) => setSettings({...settings, timeout: parseInt(e.target.value) || 30000})}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="5000"
                  max="60000"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'scraper' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* State Selection */}
              <div className="bg-white rounded-xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    📍 Sélection des États
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllStates}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      Tout
                    </button>
                    <button
                      onClick={deselectAllStates}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Aucun
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {states.map(state => (
                    <label key={state} className="flex items-center mb-2 cursor-pointer hover:bg-blue-50 p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={selectedStates.includes(state)}
                        onChange={() => toggleState(state)}
                        className="mr-3 w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{state}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  {selectedStates.length} état(s) sélectionné(s)
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white rounded-xl shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  🎮 Contrôles
                </h2>
                
                <div className="space-y-3">
                  {status === 'idle' || status === 'completed' || status === 'stopped' ? (
                    <button
                      onClick={startScraping}
                      disabled={selectedStates.length === 0}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg disabled:cursor-not-allowed"
                    >
                      <Play size={20} />
                      Démarrer l'Extraction
                    </button>
                  ) : status === 'running' ? (
                    <>
                      <button
                        onClick={pauseScraping}
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <Pause size={20} />
                        Pause
                      </button>
                      <button
                        onClick={stopScraping}
                        className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <StopCircle size={20} />
                        Arrêter
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={resumeScraping}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <Play size={20} />
                        Reprendre
                      </button>
                      <button
                        onClick={stopScraping}
                        className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <StopCircle size={20} />
                        Arrêter
                      </button>
                    </>
                  )}

                  {scrapedData.length > 0 && (
                    <>
                      <button
                        onClick={downloadExcel}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <Download size={20} />
                        Télécharger CSV ({scrapedData.length})
                      </button>
                      <button
                        onClick={downloadJSON}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg"
                      >
                        <Database size={20} />
                        Télécharger JSON
                      </button>
                    </>
                  )}
                </div>

                {errorMessage && (
                  <div className="mt-4 bg-red-50 border-l-4 border-red-500 rounded-lg p-3 flex items-start gap-2">
                    <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                )}

                {/* Progress */}
                {status !== 'idle' && status !== 'stopped' && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span className="font-medium">Progression</span>
                      <span className="font-bold">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-full transition-all duration-300 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 10 && (
                          <span className="text-white text-xs font-bold">
                            {Math.round(progress)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {currentTask && (
                      <div className="mt-3 bg-blue-50 rounded-lg p-2 flex items-center gap-2">
                        <Loader className="animate-spin text-blue-600" size={16} />
                        <span className="text-sm text-blue-800 font-medium">{currentTask}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="bg-white rounded-xl shadow-xl p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  📊 Statistiques en Direct
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600">
                      {stats.cities}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Villes scrapées</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center border border-green-200">
                    <div className="text-3xl font-bold text-green-600">
                      {stats.kitas}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Kitas trouvées</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center border border-purple-200">
                    <div className="text-3xl font-bold text-purple-600">
                      {selectedStates.length}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">États sélectionnés</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center border border-orange-200">
                    <div className="text-3xl font-bold text-orange-600">
                      {stats.errors}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Erreurs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Logs Panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    📋 Journal d'activité en temps réel
                  </h2>
                  {logs.length > 0 && (
                    <button
                      onClick={clearLogs}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 transition"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm shadow-inner">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>En attente du démarrage...</p>
                    </div>
                  ) : (
                    <>
                      {logs.map((log) => (
                        <div key={log.id} className="mb-1 hover:bg-gray-800 px-2 py-0.5 rounded">
                          <span className="text-gray-500 text-xs">[{log.timestamp}]</span>{' '}
                          <span className={getLogColor(log.type)}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {scrapedData.length === 0 ? (
              <div className="bg-white rounded-xl shadow-xl p-12 text-center">
                <BarChart3 size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                  Aucune donnée à visualiser
                </h3>
                <p className="text-gray-500 mb-4">
                  Lancez un scraping pour voir les visualisations et analyses
                </p>
                <button
                  onClick={() => setActiveTab('scraper')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition"
                >
                  Aller au Scraper
                </button>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <Building2 size={32} />
                      <TrendingUp size={24} className="opacity-75" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{scrapedData.length}</div>
                    <div className="text-blue-100 text-sm">Total Kitas</div>
                  </div>

                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <MapPin size={32} />
                      <TrendingUp size={24} className="opacity-75" />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                      {[...new Set(scrapedData.map(k => k.city))].length}
                    </div>
                    <div className="text-green-100 text-sm">Villes</div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <Globe size={32} />
                      <TrendingUp size={24} className="opacity-75" />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                      {[...new Set(scrapedData.map(k => k.state))].length}
                    </div>
                    <div className="text-purple-100 text-sm">États</div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <Database size={32} />
                      <TrendingUp size={24} className="opacity-75" />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                      {Math.round(scrapedData.reduce((acc, k) => acc + (k.capacity || 0), 0) / scrapedData.length)}
                    </div>
                    <div className="text-orange-100 text-sm">Capacité Moyenne</div>
                  </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Distribution par État */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                      <PieChart size={24} className="text-purple-600" />
                      Distribution par État
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={getChartData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>

                  {/* Top 10 Villes */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                      <BarChart3 size={24} className="text-blue-600" />
                      Top 10 Villes
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={getCityDistribution()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Statistiques détaillées */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">
                      📈 Statistiques Détaillées
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-gray-700">Total de Kitas</span>
                        <span className="font-bold text-blue-600 text-lg">{scrapedData.length}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-gray-700">Villes Couvertes</span>
                        <span className="font-bold text-green-600 text-lg">
                          {[...new Set(scrapedData.map(k => k.city))].length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                        <span className="text-gray-700">États Couverts</span>
                        <span className="font-bold text-purple-600 text-lg">
                          {[...new Set(scrapedData.map(k => k.state))].length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                        <span className="text-gray-700">Emails Collectés</span>
                        <span className="font-bold text-orange-600 text-lg">
                          {scrapedData.filter(k => k.email).length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-pink-50 rounded-lg">
                        <span className="text-gray-700">Téléphones Collectés</span>
                        <span className="font-bold text-pink-600 text-lg">
                          {scrapedData.filter(k => k.phone).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Répartition par tranche d'âge */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
                      <PieChart size={24} className="text-green-600" />
                      Répartition par Tranche d'Âge
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={(() => {
                            const ageCount = {};
                            scrapedData.forEach(kita => {
                              const age = kita.ageRange || 'Non spécifié';
                              ageCount[age] = (ageCount[age] || 0) + 1;
                            });
                            return Object.entries(ageCount).map(([name, value]) => ({ name, value }));
                          })()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {(() => {
                            const ageCount = {};
                            scrapedData.forEach(kita => {
                              const age = kita.ageRange || 'Non spécifié';
                              ageCount[age] = (ageCount[age] || 0) + 1;
                            });
                            return Object.entries(ageCount).map(([name, value]) => ({ name, value }));
                          })().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-xl p-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, ville, adresse..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterState}
                    onChange={(e) => setFilterState(e.target.value)}
                    className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Tous les États</option>
                    {[...new Set(scrapedData.map(k => k.state))].map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="name">Trier par Nom</option>
                    <option value="city">Trier par Ville</option>
                    <option value="state">Trier par État</option>
                  </select>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                Affichage de {getFilteredData().length} sur {scrapedData.length} entrées
              </div>

              {getFilteredData().length === 0 ? (
                <div className="text-center py-12">
                  <Filter size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Aucun résultat trouvé</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nom</th>
                        <th className="px-4 py-3 text-left font-semibold">Adresse</th>
                        <th className="px-4 py-3 text-left font-semibold">Ville</th>
                        <th className="px-4 py-3 text-left font-semibold">État</th>
                        <th className="px-4 py-3 text-left font-semibold">Contact</th>
                        <th className="px-4 py-3 text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredData().slice(0, 50).map((kita, idx) => (
                        <React.Fragment key={idx}>
                          <tr className="border-b hover:bg-blue-50 transition">
                            <td className="px-4 py-3 font-medium">{kita.name}</td>
                            <td className="px-4 py-3 text-sm">
                              {kita.street_address}<br />
                              <span className="text-gray-500">{kita.postal_code}</span>
                            </td>
                            <td className="px-4 py-3">{kita.city}</td>
                            <td className="px-4 py-3">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                {kita.state}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {kita.phone && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Phone size={14} className="text-gray-400" />
                                  <span>{kita.phone}</span>
                                </div>
                              )}
                              {kita.email && (
                                <div className="flex items-center gap-1">
                                  <Mail size={14} className="text-gray-400" />
                                  <span className="text-blue-600">{kita.email}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                className="text-purple-600 hover:text-purple-800 transition"
                              >
                                {expandedRow === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </button>
                            </td>
                          </tr>
                          {expandedRow === idx && (
                            <tr className="bg-gray-50">
                              <td colSpan="6" className="px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Informations Complètes</h4>
                                    <div className="space-y-2 text-sm">
                                      <div><span className="font-medium">ID:</span> {kita.id}</div>
                                      <div><span className="font-medium">Capacité:</span> {kita.capacity || 'Non spécifiée'}</div>
                                      <div><span className="font-medium">Tranche d'âge:</span> {kita.ageRange || 'Non spécifiée'}</div>
                                      {kita.website && (
                                        <div className="flex items-center gap-2">
                                          <Globe size={14} />
                                          <a href={`https://${kita.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {kita.website}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Actions</h4>
                                    <div className="space-y-2">
                                      <button className="w-full text-left px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm">
                                        📧 Envoyer un email
                                      </button>
                                      <button className="w-full text-left px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-sm">
                                        📞 Appeler
                                      </button>
                                      <button className="w-full text-left px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition text-sm">
                                        🗺️ Voir sur la carte
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  {getFilteredData().length > 50 && (
                    <div className="bg-gray-50 text-center py-3 text-gray-600 text-sm">
                      Affichage des 50 premières entrées sur {getFilteredData().length}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-xl p-6">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                <Calendar size={28} className="text-purple-600" />
                Historique des Scraping
              </h2>

              {historyData.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar size={64} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Aucun historique
                  </h3>
                  <p className="text-gray-500">
                    Les sessions de scraping seront enregistrées ici
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={20} className="text-purple-600" />
                            <span className="font-semibold text-lg">
                              {new Date(item.date).toLocaleDateString('fr-FR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div className="bg-blue-50 rounded p-2">
                              <div className="text-2xl font-bold text-blue-600">{item.totalKitas}</div>
                              <div className="text-xs text-gray-600">Kitas</div>
                            </div>
                            <div className="bg-green-50 rounded p-2">
                              <div className="text-2xl font-bold text-green-600">{item.totalCities}</div>
                              <div className="text-xs text-gray-600">Villes</div>
                            </div>
                            <div className="bg-purple-50 rounded p-2">
                              <div className="text-2xl font-bold text-purple-600">{item.states.length}</div>
                              <div className="text-xs text-gray-600">États</div>
                            </div>
                            <div className="bg-orange-50 rounded p-2">
                              <div className="text-2xl font-bold text-orange-600">{item.duration}</div>
                              <div className="text-xs text-gray-600">Durée</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {item.states.map((state, idx) => (
                              <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                {state}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => loadHistoryData(item)}
                            className="bg-blue-100 text-blue-700 p-2 rounded hover:bg-blue-200 transition"
                            title="Charger ces données"
                          >
                            <Database size={20} />
                          </button>
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            className="bg-red-100 text-red-700 p-2 rounded hover:bg-red-200 transition"
                            title="Supprimer"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-6 shadow-xl">
          <div className="flex items-start gap-4 text-white">
            <AlertCircle className="flex-shrink-0 mt-1" size={24} />
            <div className="text-sm">
              <p className="font-semibold text-lg mb-2">🎓 Web Scraping & Visualisation</p>
              <p className="text-blue-100 mb-2">
                Cette application démontre les compétences suivantes :
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-100">
                <li><strong>Web Scraping</strong> : Extraction automatique de données depuis kita.de</li>
                <li><strong>Visualisation</strong> : Tableaux de bord interactifs avec graphiques (Bar, Pie, Line Charts)</li>
                <li><strong>Base de données</strong> : Stockage et gestion des données avec historique</li>
                <li><strong>Interface utilisateur</strong> : React.js avec design moderne et intuitif</li>
                <li><strong>Backend</strong> : Flask/Python pour le scraping et l'API REST</li>
                <li><strong>Temps réel</strong> : WebSocket pour les mises à jour en direct</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitaScraperApp;