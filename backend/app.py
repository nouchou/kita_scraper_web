from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import threading
import time
from scraper import KitaScraper

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# État global du scraping
scraping_state = {
    'status': 'idle',
    'progress': 0,
    'current_task': '',
    'stats': {'cities': 0, 'kitas': 0, 'errors': 0},
    'data': [],
    'should_stop': False,
    'should_pause': False
}

scraper = None

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Backend is running'})

@app.route('/api/start-scraping', methods=['POST'])
def start_scraping():
    global scraper, scraping_state
    
    data = request.json
    states = data.get('states', [])
    settings = data.get('settings', {})
    
    # Ajouter le paramètre extract_details (par défaut False pour plus de rapidité)
    if 'extract_details' not in settings:
        settings['extract_details'] = True  # Mettre True pour extraire email, tel, website
    
    if not states:
        return jsonify({'error': 'No states selected'}), 400
    
    # Réinitialiser l'état
    scraping_state = {
        'status': 'running',
        'progress': 0,
        'current_task': '',
        'stats': {'cities': 0, 'kitas': 0, 'errors': 0},
        'data': [],
        'should_stop': False,
        'should_pause': False
    }
    
    # Démarrer le scraping dans un thread séparé
    scraper = KitaScraper(states, settings, socketio, scraping_state)
    thread = threading.Thread(target=scraper.run)
    thread.daemon = True
    thread.start()
    
    return jsonify({'message': 'Scraping started', 'status': 'running'})

@app.route('/api/pause-scraping', methods=['POST'])
def pause_scraping():
    scraping_state['should_pause'] = True
    scraping_state['status'] = 'paused'
    socketio.emit('status_update', {'status': 'paused'})
    return jsonify({'message': 'Scraping paused'})

@app.route('/api/resume-scraping', methods=['POST'])
def resume_scraping():
    scraping_state['should_pause'] = False
    scraping_state['status'] = 'running'
    socketio.emit('status_update', {'status': 'running'})
    return jsonify({'message': 'Scraping resumed'})

@app.route('/api/stop-scraping', methods=['POST'])
def stop_scraping():
    scraping_state['should_stop'] = True
    scraping_state['status'] = 'stopped'
    socketio.emit('status_update', {'status': 'stopped'})
    return jsonify({'message': 'Scraping stopped'})

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': scraping_state['status'],
        'progress': scraping_state['progress'],
        'stats': scraping_state['stats'],
        'data_count': len(scraping_state['data'])
    })

@app.route('/api/data', methods=['GET'])
def get_data():
    """Récupérer toutes les données scrapées"""
    return jsonify({
        'data': scraping_state['data'],
        'count': len(scraping_state['data'])
    })

@app.route('/api/export-csv', methods=['GET'])
def export_csv():
    """Exporter les données en CSV"""
    import csv
    import io
    from flask import make_response
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'id', 'name', 'street_address', 'postal_code', 'city', 'state',
        'phone', 'email', 'website', 'url', 'description'
    ])
    writer.writeheader()
    writer.writerows(scraping_state['data'])
    
    response = make_response(output.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=kitas_export.csv'
    response.headers['Content-Type'] = 'text/csv'
    return response

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connection_response', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    print("🚀 Starting Kita Scraper Backend...")
    print("🔍 Server running on http://localhost:5000")
    print("\n⚙️ Configuration:")
    print("   - Mode de scraping: RAPIDE (sans détails)")
    print("   - Pour extraire emails/téléphones/websites, modifiez extract_details=True")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)