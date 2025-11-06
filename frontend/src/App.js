import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Play, Pause, StopCircle, AlertCircle, Loader, Settings, Database, XCircle, BarChart3, PieChart, TrendingUp, Search, Filter, Calendar, MapPin, Building2, Phone, Mail, Globe, ChevronDown, ChevronUp, Trash2, Zap, Clock } from 'lucide-react';
import io from 'socket.io-client';

const KitaScraperApp = () => {
  const [activeTab, setActiveTab] = useState('scraper');
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
    timeout: 30000,
    extract_details: false // Mode RAPIDE par défaut
  });
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [historyData, setHistoryData] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const logsEndRef = useRef(null);
  const statusRef = useRef('idle');
  const socketRef = useRef(null);

  const states = [
    'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
    'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'
  ];

  const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1'];

  const CONTACT_TYPES = {
    email: { icon: Mail, label: 'Email', color: 'blue' },
    phone: { icon: Phone, label: 'Téléphone', color: 'green' },
    fax: { icon: Phone, label: 'Fax', color: 'orange' },
    website: { icon: Globe, label: 'Site Web', color: 'purple' }
  };

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Update WebSocket connection with better error handling
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true
    });

    socket.on('connect', () => {
      setIsConnected(true);
      addLog('✅ Connecté au serveur backend', 'success');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      addLog('❌ Déconnecté du serveur', 'error');
    });

    socket.on('log', (data) => {
      addLog(data.message, data.level);
    });

    socket.on('progress', (data) => {
      setProgress(data.progress);
      setCurrentTask(data.task);
    });

    socket.on('data', (data) => {
      setScrapedData(prev => [...prev, ...data.kitas]);
    });

    socket.on('stats', (data) => {
      setStats(data.stats);
    });

    socket.on('status_update', (data) => {
      setStatus(data.status);
      
      // Si le scraping est terminé, sauvegarder dans l'historique
      if (data.status === 'completed') {
        const duration = calculateDuration();
        saveToHistory({
          data: scrapedData,
          stats: stats,
          duration: duration
        });
      }
    });

    socket.on('error', (data) => {
      setErrorMessage(data.message);
      setStatus('error');
    });

    // Nouvelle écoute pour les mises à jour de progression détaillées
    socket.on('progress_update', (data) => {
      setProgress(data.progress);
      setCurrentTask(data.task);
      setProgressDetails({
        current_state: data.current_state,
        total_states: data.total_states,
        processed_kitas: data.processed_kitas
      });
      setStats(data.stats);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection Error:', error);
      setIsConnected(false);
      addLog('❌ Erreur de connexion au serveur: ' + error.message, 'error');
    });

    socket.on('connect_timeout', () => {
      setIsConnected(false);
      addLog('❌ Timeout de connexion au serveur', 'error');
    });

    // Update history persistence with better error handling
    const saveHistoryToLocalStorage = (data) => {
      try {
        localStorage.setItem('kita_scraping_history', JSON.stringify(data));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        addLog('⚠️ Erreur de sauvegarde de l\'historique', 'warning');
      }
    };

    // Load history with error handling
    const loadHistoryFromLocalStorage = () => {
      try {
        const savedHistory = localStorage.getItem('kita_scraping_history');
        if (savedHistory) {
          setHistoryData(JSON.parse(savedHistory));
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
        addLog('⚠️ Erreur de chargement de l\'historique', 'warning');
      }
    };

    // Update saveToHistory function
    const saveToHistory = (data) => {
      try {
        const historyEntry = {
          id: Date.now(),
          date: new Date().toISOString(),
          states: selectedStates,
          totalKitas: data.data.length,
          totalCities: data.stats.cities,
          errors: data.stats.errors,
          duration: data.duration,
          data: data.data // Sauvegarder les données complètes
        };
        
        const newHistory = [historyEntry, ...historyData].slice(0, 10);
        setHistoryData(newHistory);
        
        try {
          localStorage.setItem('kita_scraping_history', JSON.stringify(newHistory));
          addLog('✅ Session sauvegardée dans l\'historique', 'success');
        } catch (e) {
          addLog('⚠️ Erreur lors de la sauvegarde dans localStorage', 'warning');
          console.error('localStorage error:', e);
        }
      } catch (error) {
        console.error('Error saving history:', error);
        addLog('⚠️ Erreur lors de la sauvegarde de l\'historique', 'warning');
      }
    };

    // Load history on mount
    loadHistoryFromLocalStorage();

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
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
      duration: '5m 32s',
      data: data
    };
    
    const newHistory = [historyEntry, ...historyData].slice(0, 10);
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

    if (!isConnected) {
      setErrorMessage('Non connecté au serveur backend. Assurez-vous que le backend est démarré.');
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
    addLog(`⚙️ Mode: ${settings.extract_details ? 'COMPLET (avec emails/téléphones)' : 'RAPIDE (sans détails)'}`, 'info');

    try {
      const response = await fetch('http://localhost:5000/api/start-scraping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ states: selectedStates, settings })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du démarrage du scraping');
      }

      addLog('✅ Scraping démarré sur le serveur', 'success');
    } catch (error) {
      setErrorMessage(`Erreur: ${error.message}`);
      setStatus('error');
      addLog(`❌ Erreur: ${error.message}`, 'error');
    }
  };

  const pauseScraping = async () => {
    try {
      await fetch('http://localhost:5000/api/pause-scraping', { method: 'POST' });
      setStatus('paused');
      addLog('⏸️ Scraping mis en pause', 'warning');
    } catch (error) {
      addLog(`❌ Erreur pause: ${error.message}`, 'error');
    }
  };

  const resumeScraping = async () => {
    try {
      await fetch('http://localhost:5000/api/resume-scraping', { method: 'POST' });
      setStatus('running');
      addLog('▶️ Scraping repris', 'info');
    } catch (error) {
      addLog(`❌ Erreur reprise: ${error.message}`, 'error');
    }
  };

  const stopScraping = async () => {
    try {
      await fetch('http://localhost:5000/api/stop-scraping', { method: 'POST' });
      setStatus('stopped');
      addLog('⏹️ Scraping arrêté par l\'utilisateur', 'warning');
      setCurrentTask('');
      
      // Sauvegarder dans l'historique quand on arrête
      const duration = calculateDuration();
      saveToHistory({
        data: scrapedData,
        stats: stats,
        duration: duration
      });
    } catch (error) {
      addLog(`❌ Erreur arrêt: ${error.message}`, 'error');
    }
  };

  // Ajouter cette fonction pour calculer la durée
  const calculateDuration = () => {
    // Pour l'instant on retourne une valeur fixe, 
    // on pourra implémenter le vrai calcul plus tard
    return "5m 32s";
  };

  const downloadExcel = () => {
    const headers = ['ID', 'Name', 'Street Address', 'Postal Code', 'City', 'State', 'Phone', 'Email', 'Website', 'URL', 'Description'];
    const csvContent = [
      headers.join(','),
      ...scrapedData.map(row => 
        [row.id, row.name, row.street_address, row.postal_code, row.city, row.state, row.phone || '', row.email || '', row.website || '', row.url || '', row.description || '']
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
      case 'error': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'success': return 'text-emerald-500';
      case 'info': return 'text-sky-400';
      default: return 'text-slate-300';
    }
  };

  const getChartData = () => {
    const stateCount = {};
    scrapedData.forEach(kita => {
      stateCount[kita.state] = (stateCount[kita.state] || 0) + 1;
    });
    return Object.entries(stateCount)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
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

  const getFilteredData = () => {
    let filtered = scrapedData;
    
    if (searchTerm) {
      filtered = filtered.filter(kita => 
        kita.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kita.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kita.street_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (kita.email && kita.email.toLowerCase().includes(searchTerm.toLowerCase()))
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

  const CustomBarChart = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className="bg-white rounded-xl shadow-xl p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <BarChart3 size={24} className="text-blue-600" />
          {title}
        </h3>
        <div className="space-y-3">
          {data.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{item.name}</span>
                <span className="font-bold text-blue-600">{item.value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 text-white text-xs font-bold transition-all duration-500"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: COLORS[idx % COLORS.length]
                  }}
                >
                  {(item.value / maxValue) * 100 > 15 && `${item.value}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CustomPieChart = ({ data, title }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <div className="bg-white rounded-xl shadow-xl p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <PieChart size={24} className="text-purple-600" />
          {title}
        </h3>
        <div className="space-y-2">
          {data.map((item, idx) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            return (
              <div key={idx} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{item.name}</span>
                    <span className="text-gray-600">{percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[idx % COLORS.length]
                      }}
                    />
                  </div>
                </div>
                <span className="font-bold text-gray-800 text-sm">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Ajouter un nouveau state pour les statistiques détaillées
  const [progressDetails, setProgressDetails] = useState({
    current_state: '',
    total_states: 0,
    processed_kitas: 0
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3 flex items-center gap-3">
                🎓 Kita Scraper 

              </h1>
              <p className="text-gray-600 text-lg">
                Extraction et analyse intelligente des données Kita
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className={`flex items-center gap-2 ${
                  isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                } px-3 py-1.5 rounded-full`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  } animate-pulse`} />
                  <span className="text-sm font-medium">
                    {isConnected ? 'Système connecté' : 'Système déconnecté'}
                  </span>
                </div>
                {status === 'running' && (
                  <div className="bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <Loader className="animate-spin text-blue-600" size={14} />
                    <span className="text-blue-700 text-sm font-medium">Scraping en cours</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-lg transition-all duration-300 ${
                showSettings 
                  ? 'bg-blue-100 text-blue-600 shadow-lg scale-105' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Paramètres avancés"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* Panneau de paramètres */}
        {showSettings && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Settings size={24} className="text-blue-600" />
                Paramètres de Scraping
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Mode de scraping */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Mode d'extraction</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                    !settings.extract_details 
                      ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                      : 'bg-white border-2 border-gray-200 hover:border-blue-200'
                  }`}>
                    <input
                      type="radio"
                      name="scraping-mode"
                      checked={!settings.extract_details}
                      onChange={() => setSettings({...settings, extract_details: false})}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Mode Rapide</div>
                      <p className="text-sm text-gray-600 mt-1">
                        • Nom et adresse uniquement<br/>
                        • ~1-2 secondes par ville<br/>
                        • Idéal pour un aperçu rapide
                      </p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                    settings.extract_details 
                      ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                      : 'bg-white border-2 border-gray-200 hover:border-blue-200'
                  }`}>
                    <input
                      type="radio"
                      name="scraping-mode"
                      checked={settings.extract_details}
                      onChange={() => setSettings({...settings, extract_details: true})}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Mode Complet</div>
                      <p className="text-sm text-gray-600 mt-1">
                        • Inclut email, téléphone, fax, site web<br/>
                        • ~5-10 secondes par ville<br/>
                        • Pour une analyse détaillée
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Paramètres avancés */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Paramètres avancés</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Délai entre requêtes (ms)
                    </label>
                    <input
                      type="number"
                      value={settings.delay}
                      onChange={(e) => setSettings({...settings, delay: parseInt(e.target.value) || 500})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="100"
                      max="5000"
                    />
                    <p className="mt-1 text-xs text-gray-500">Recommandé: 500ms</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de tentatives
                    </label>
                    <input
                      type="number"
                      value={settings.maxRetries}
                      onChange={(e) => setSettings({...settings, maxRetries: parseInt(e.target.value) || 3})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="10"
                    />
                    <p className="mt-1 text-xs text-gray-500">Recommandé: 3 tentatives</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={settings.timeout}
                      onChange={(e) => setSettings({...settings, timeout: parseInt(e.target.value) || 30000})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="5000"
                      max="60000"
                    />
                    <p className="mt-1 text-xs text-gray-500">Recommandé: 30000ms</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation  */}
        <div className="bg-white rounded-xl shadow-sm mb-8 p-2 flex gap-2 overflow-x-auto border border-gray-100">
          {[
            { id: 'scraper', icon: Database, label: 'Web Scraper' },
            { id: 'dashboard', icon: BarChart3, label: 'Tableau de Bord' },
            { id: 'data', icon: Filter, label: 'Données Extraites' },
            { id: 'history', icon: Calendar, label: 'Historique' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteneurs  */}
        <div className="grid gap-6">
          {/* Scraper Tab */}
          {activeTab === 'scraper' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Panel - Configuration */}
              <div className="lg:w-1/3">
                <div className="space-y-6">
                  {/* State Selection */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                           Sélection des États
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
                  </div>

                  {/* Controls */}
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">
                      🎮 Contrôles
                    </h2>
                    
                    <div className="space-y-3">
                      {status === 'idle' || status === 'completed' || status === 'stopped' ? (
                        <button
                          onClick={startScraping}
                          disabled={selectedStates.length === 0 || !isConnected}
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
                  </div>
                </div>
              </div>

              {/* Right Panel  */}
              <div className="lg:w-2/3">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-800">Journal d'activité</h2>
                      <div className="px-2 py-1 bg-blue-50 rounded-md text-sm text-blue-700">
                        temps réel
                      </div>
                    </div>
                    {logs.length > 0 && (
                      <button
                        onClick={clearLogs}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                      >
                        <XCircle size={14} />
                        Effacer
                      </button>
                    )}
                  </div>

                  {/* Terminal avec fond noir */}
                  <div className="h-[calc(100vh-12rem)] flex flex-col">
                    <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-y-auto font-mono text-sm">
                      {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500">
                          <div className="text-center">
                            <Clock className="w-8 h-8 mx-auto mb-2" />
                            <p>En attente du démarrage...</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {logs.map((log) => (
                            <div 
                              key={log.id} 
                              className={`px-3 py-1.5 rounded-lg mb-1 ${
                                log.type === 'error' ? 'bg-red-950/30' :
                                log.type === 'warning' ? 'bg-amber-950/30' :
                                log.type === 'success' ? 'bg-emerald-950/30' :
                                'hover:bg-gray-800'
                              } transition-colors`}
                            >
                              <span className="text-slate-500 text-xs mr-2 font-mono">
                                [{log.timestamp}]
                              </span>
                              <span className={`${getLogColor(log.type)} font-medium`}>
                                {log.message}
                              </span>
                            </div>
                          ))}
                          <div ref={logsEndRef} />
                        </>
                      )}
                    </div>

                    {/* Status Bar avec meilleure visibilité */}
                    {status !== 'idle' && status !== 'stopped' && (
                      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Loader className="animate-spin text-blue-600" size={16} />
                            <span className="font-medium text-gray-700">Progression</span>
                          </div>
                          <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                            {Math.round(progress)}%
                          </span>
                        </div>

                        {/* Barre de progression animée */}
                        <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-shimmer"></div>
                          </div>
                        </div>

                        {/* Détails de la progression */}
                        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-blue-700 font-medium">{stats.kitas}</div>
                            <div className="text-gray-600">Kitas collectées</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-green-700 font-medium">{stats.cities}</div>
                            <div className="text-gray-600">Villes traitées</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="text-purple-700 font-medium">{stats.errors}</div>
                            <div className="text-gray-600">Erreurs</div>
                          </div>
                        </div>

                        {/* Tâche en cours */}
                        {currentTask && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span>{currentTask}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* KPI Cards améliorées */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total Kitas */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 size={24} className="text-blue-600" />
                    </div>
                    <TrendingUp size={20} className="text-blue-600" />
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">{scrapedData.length}</div>
                  <div className="text-sm font-medium text-gray-500">Total Kitas</div>
                </div>

                {/* Villes */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <MapPin size={24} className="text-green-600" />
                    </div>
                    <TrendingUp size={20} className="text-green-600" />
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">
                    {[...new Set(scrapedData.map(k => k.city))].length}
                  </div>
                  <div className="text-sm font-medium text-gray-500">Villes</div>
                </div>

                {/* États */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Globe size={24} className="text-purple-600" />
                    </div>
                    <TrendingUp size={20} className="text-purple-600" />
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">
                    {[...new Set(scrapedData.map(k => k.state))].length}
                  </div>
                  <div className="text-sm font-medium text-gray-500">États</div>
                </div>

                {/* Emails */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Mail size={24} className="text-orange-600" />
                    </div>
                    <TrendingUp size={20} className="text-orange-600" />
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">
                    {scrapedData.filter(k => k.email).length}
                  </div>
                  <div className="text-sm font-medium text-gray-500">Emails Collectés</div>
                </div>
              </div>

              {/* Stats détaillées avec meilleure lisibilité */}
              <div className="bg-white rounded-xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                  <BarChart3 size={24} className="text-blue-600" />
                  Statistiques Détaillées
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { 
                      label: "Total Kitas",
                      value: scrapedData.length,
                      bg: "bg-blue-50",
                      text: "text-blue-700",
                      icon: Building2
                    },
                    {
                      label: "Villes",
                      value: [...new Set(scrapedData.map(k => k.city))].length,
                      bg: "bg-green-50",
                      text: "text-green-700",
                      icon: MapPin
                    },
                    {
                      label: "États",
                      value: [...new Set(scrapedData.map(k => k.state))].length,
                      bg: "bg-purple-50",
                      text: "text-purple-700",
                      icon: Globe
                    },
                    {
                      label: "Emails",
                      value: scrapedData.filter(k => k.email).length,
                      bg: "bg-orange-50",
                      text: "text-orange-700",
                      icon: Mail
                    },
                    {
                      label: "Téléphones",
                      value: scrapedData.filter(k => k.phone).length,
                      bg: "bg-pink-50",
                      text: "text-pink-700",
                      icon: Phone
                    },
                    {
                      label: "Sites Web",
                      value: scrapedData.filter(k => k.website).length,
                      bg: "bg-indigo-50",
                      text: "text-indigo-700",
                      icon: Globe
                    }
                  ].map((stat, idx) => (
                    <div key={idx} className={`${stat.bg} rounded-xl p-4 flex items-center gap-3`}>
                      <div className="p-2 bg-white rounded-lg">
                        <stat.icon size={20} className={stat.text} />
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${stat.text}`}>
                          {stat.value}
                        </div>
                        <div className="text-sm font-medium text-gray-600">
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts  */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <h3 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                    <PieChart size={24} className="text-blue-600" />
                    Distribution par État
                  </h3>
                  <div className="p-4">
                    <CustomPieChart data={getChartData()} />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                  <h3 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
                    <BarChart3 size={24} className="text-purple-600" />
                    Top 10 Villes
                  </h3>
                  <div className="p-4">
                    <CustomBarChart data={getCityDistribution()} />
                  </div>
                </div>
              </div>
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
                      placeholder="Rechercher par nom, ville, adresse, email..."
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
                              <td className="px-4 py-3 text-sm space-y-1.5">
                                {Object.entries(CONTACT_TYPES).map(([type, config]) => {
                                  const value = kita[type];
                                  if (!value) return null;
                                  
                                  const Icon = config.icon;
                                  return (
                                    <div key={type} className="flex items-center gap-2">
                                      <div className={`p-1 rounded-full bg-${config.color}-50`}>
                                        <Icon size={14} className={`text-${config.color}-600`} />
                                      </div>
                                      {type === 'website' ? (
                                        <a
                                          href={value}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`text-${config.color}-600 hover:underline truncate max-w-[200px]`}
                                        >
                                          {value.replace(/^https?:\/\//, '')}
                                        </a>
                                      ) : (
                                        <a
                                          href={type === 'email' ? `mailto:${value}` : `tel:${value}`}
                                          className={`text-${config.color}-600 hover:underline`}
                                        >
                                          {value}
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
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
                                        <div><span className="font-medium">Nom complet:</span> {kita.name}</div>
                                        <div><span className="font-medium">Adresse:</span> {kita.street_address}</div>
                                        <div><span className="font-medium">Code postal:</span> {kita.postal_code}</div>
                                        <div><span className="font-medium">Ville:</span> {kita.city}</div>
                                        <div><span className="font-medium">État:</span> {kita.state}</div>
                                        {kita.phone && <div><span className="font-medium">Téléphone:</span> {kita.phone}</div>}
                                        {kita.email && <div><span className="font-medium">Email:</span> {kita.email}</div>}
                                        {kita.website && (
                                          <div>
                                            <span className="font-medium">Website:</span>{' '}
                                            <a href={kita.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                              {kita.website}
                                            </a>
                                          </div>
                                        )}
                                        {kita.description && (
                                          <div>
                                            <span className="font-medium">Description:</span>
                                            <p className="mt-1 text-gray-600">{kita.description}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-gray-700 mb-2">Actions Rapides</h4>
                                      <div className="space-y-2">
                                        {kita.email && (
                                          <a
                                            href={`mailto:${kita.email}`}
                                            className="block w-full text-left px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm"
                                          >
                                            📧 Envoyer un email
                                          </a>
                                        )}
                                        {kita.phone && (
                                          <a
                                            href={`tel:${kita.phone}`}
                                            className="block w-full text-left px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-sm"
                                          >
                                            📞 Appeler
                                          </a>
                                        )}
                                        {kita.website && (
                                          <a
                                            href={kita.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full text-left px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition text-sm"
                                          >
                                            🌐 Visiter le site
                                          </a>
                                        )}
                                        {kita.url && (
                                          <a
                                            href={kita.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full text-left px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition text-sm"
                                          >
                                            🔗 Voir sur kita.de
                                          </a>
                                        )}
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

          {/* Footer avec style Google */}
          <div className="mt-8 bg-white rounded-xl p-8 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4 text-gray-800">
              <AlertCircle className="flex-shrink-0 mt-1" size={24} />
              <div className="text-sm">
                <p className="font-semibold text-lg mb-2">Projet Académique - Web Scraping & Visualisation</p>
                <p className="text-blue-600 mb-2">
                  Cette application démontre les compétences suivantes :
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li><strong>Web Scraping</strong> : Extraction automatique depuis kita.de (Selenium + BeautifulSoup)</li>
                  <li><strong>Visualisation</strong> : Tableaux de bord interactifs avec graphiques personnalisés</li>
                  <li><strong>Base de données</strong> : Stockage et gestion avec historique persistant</li>
                  <li><strong>Interface utilisateur</strong> : React.js avec Socket.IO pour temps réel</li>
                  <li><strong>Backend</strong> : Flask/Python avec API REST</li>
                  <li><strong>Données collectées</strong> : Nom, Adresse, Email, Téléphone, Website, Description</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitaScraperApp;

