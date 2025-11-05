import time
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
import re
import math

class KitaScraper:
    def __init__(self, states, settings, socketio, scraping_state):
        self.states = states
        self.settings = settings
        self.socketio = socketio
        self.state = scraping_state
        self.driver = None
        
    def emit_log(self, message, level='info'):
        """Envoyer un log au frontend"""
        self.socketio.emit('log', {
            'type': 'log',
            'message': message,
            'level': level
        })
        print(f"[{level.upper()}] {message}")
    
    def emit_progress(self, progress, task):
        """Mettre à jour la progression"""
        self.state['progress'] = progress
        self.state['current_task'] = task
        self.socketio.emit('progress', {
            'type': 'progress',
            'progress': progress,
            'task': task
        })
    
    def emit_data(self, kitas):
        """Envoyer des données au frontend"""
        self.state['data'].extend(kitas)
        self.socketio.emit('data', {
            'type': 'data',
            'kitas': kitas
        })
    
    def emit_stats(self):
        """Envoyer les statistiques"""
        self.socketio.emit('stats', {
            'type': 'stats',
            'stats': self.state['stats']
        })
    
    def setup_driver(self):
        """Configurer Selenium WebDriver"""
        try:
            options = Options()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
            self.emit_log("✅ WebDriver initialisé", "success")
            return True
        except Exception as e:
            self.emit_log(f"❌ Erreur WebDriver: {str(e)}", "error")
            return False
    
    def transliterate(self, text):
        """Translitération des caractères allemands"""
        translit = {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
            'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'
        }
        return ''.join(translit.get(c, c) for c in text)
    
    def extract_detail_info(self, kita_url):
        """Extraire les informations détaillées d'une page Kita"""
        try:
            self.driver.get(kita_url)
            time.sleep(1)  # Attendre le chargement de la page
            
            detail_info = {
                'phone': None,
                'email': None,
                'website': None,
                'description': None
            }
            
            # Extraire le téléphone
            try:
                phone_elem = self.driver.find_element(By.XPATH, "//a[contains(@href, 'tel:')]")
                detail_info['phone'] = phone_elem.text.strip()
            except:
                pass
            
            # Extraire l'email
            try:
                email_elem = self.driver.find_element(By.XPATH, "//a[contains(@href, 'mailto:')]")
                email_text = email_elem.get_attribute('href').replace('mailto:', '')
                detail_info['email'] = email_text.strip()
            except:
                pass
            
            # Extraire le site web
            try:
                # Chercher un lien externe (pas kita.de)
                website_elem = self.driver.find_element(By.XPATH, "//a[contains(@class, 'btn') and contains(text(), 'Website') or contains(text(), 'Webseite')]")
                website_url = website_elem.get_attribute('href')
                if website_url and 'kita.de' not in website_url:
                    detail_info['website'] = website_url
            except:
                # Alternative : chercher dans les liens
                try:
                    links = self.driver.find_elements(By.XPATH, "//a[starts-with(@href, 'http')]")
                    for link in links:
                        href = link.get_attribute('href')
                        if href and 'kita.de' not in href and 'mailto:' not in href and 'tel:' not in href:
                            detail_info['website'] = href
                            break
                except:
                    pass
            
            # Extraire la description
            try:
                desc_elem = self.driver.find_element(By.CLASS_NAME, "profile-description")
                detail_info['description'] = desc_elem.text.strip()[:200]  # Limiter à 200 caractères
            except:
                pass
            
            return detail_info
            
        except Exception as e:
            self.emit_log(f"      ⚠️ Erreur extraction détails: {str(e)}", "warning")
            return {
                'phone': None,
                'email': None,
                'website': None,
                'description': None
            }
    
    def scrape_city(self, state_link, city_name):
        """Scraper une ville"""
        try:
            city_url = f"{state_link}/{self.transliterate(city_name).lower()}"
            self.emit_log(f"  🏙️ Scraping de {city_name}...", "info")
            
            self.driver.get(city_url)
            time.sleep(self.settings.get('delay', 500) / 1000)
            
            # Trouver le nombre de pages
            html = self.driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            pagination = soup.find("ul", class_="pagination list-unstyled")
            
            pages = 1
            if pagination:
                last_page = pagination.find_all("a")[-1]
                if last_page:
                    href = last_page.get("href", "")
                    match = re.search(r'p=(\d+)', href)
                    if match:
                        pages = int(match.group(1))
            
            self.emit_log(f"    📄 {pages} page(s) à scraper", "info")
            kitas = []
            
            for page in range(1, pages + 1):
                if self.state['should_stop']:
                    return kitas
                
                while self.state['should_pause']:
                    time.sleep(0.5)
                
                page_url = f"{city_url}/p={page}"
                self.driver.get(page_url)
                time.sleep(self.settings.get('delay', 500) / 1000)
                
                try:
                    listing = self.driver.find_element(By.CLASS_NAME, "profile_listing")
                    items = listing.find_elements(By.CLASS_NAME, "media")
                    
                    self.emit_log(f"    📋 Page {page}: {len(items)} kitas trouvées", "info")
                    
                    for item in items:
                        try:
                            # Extraire le lien et le nom
                            link_elem = item.find_element(By.XPATH, ".//h3/a")
                            name = link_elem.text.strip()
                            kita_href = link_elem.get_attribute('href')
                            kita_id = kita_href.split('/')[-1]
                            
                            # Extraire l'adresse
                            address_elem = item.find_element(By.XPATH, ".//p/small")
                            address_html = address_elem.get_attribute('innerHTML')
                            parts = [p.strip() for p in address_html.split("<br>")]
                            
                            street = ""
                            postal_code = ""
                            city = city_name
                            state = ""
                            
                            if len(parts) >= 1:
                                street = parts[0].strip()
                            
                            if len(parts) >= 2:
                                postal_parts = parts[1].strip().split()
                                if len(postal_parts) >= 1:
                                    postal_code = postal_parts[0]
                                if len(postal_parts) > 1:
                                    city = " ".join(postal_parts[1:])
                            
                            if len(parts) >= 3:
                                state = parts[2].strip()
                            
                            # Créer l'objet de base
                            kita_data = {
                                'id': kita_id,
                                'name': name,
                                'street_address': street,
                                'postal_code': postal_code,
                                'city': city,
                                'state': state,
                                'url': kita_href,
                                'phone': None,
                                'email': None,
                                'website': None,
                                'description': None
                            }
                            
                            # Extraire les détails depuis la page de détail (OPTIONNEL - ralentit le scraping)
                            if self.settings.get('extract_details', False):
                                self.emit_log(f"      🔍 Extraction des détails pour {name[:30]}...", "info")
                                detail_info = self.extract_detail_info(kita_href)
                                kita_data.update(detail_info)
                                # Retour à la page de listing
                                self.driver.get(page_url)
                                time.sleep(0.5)
                            
                            kitas.append(kita_data)
                            self.state['stats']['kitas'] += 1
                        
                        except Exception as e:
                            self.emit_log(f"      ⚠️ Erreur élément: {str(e)}", "warning")
                            self.state['stats']['errors'] += 1
                
                except Exception as e:
                    self.emit_log(f"    ⚠️ Pas de listing sur page {page}: {str(e)}", "warning")
            
            if kitas:
                self.emit_log(f"  ✅ {len(kitas)} kitas trouvées dans {city_name}", "success")
                self.emit_data(kitas)
            
            self.state['stats']['cities'] += 1
            return kitas
        
        except Exception as e:
            self.emit_log(f"  ❌ Erreur {city_name}: {str(e)}", "error")
            self.state['stats']['errors'] += 1
            return []
    
    def run(self):
        """Exécuter le scraping"""
        try:
            self.emit_log("🚀 Démarrage du scraping...", "info")
            
            if not self.setup_driver():
                return
            
            base_url = "https://kita.de/kitas"
            total_states = len(self.states)
            
            for idx, state in enumerate(self.states):
                if self.state['should_stop']:
                    break
                
                self.emit_log(f"\n📂 État {idx+1}/{total_states}: {state}", "info")
                state_url = f"{base_url}/{self.transliterate(state).lower()}"
                
                try:
                    self.driver.get(state_url)
                    time.sleep(1)
                    
                    # Trouver les villes
                    cities = self.driver.find_elements(By.CSS_SELECTOR, '.cities li')
                    total_cities = len(cities)
                    self.emit_log(f"  🔍 {total_cities} villes trouvées", "info")
                    
                    # Extraire les noms de villes avant de boucler
                    city_names = []
                    for city_elem in cities:
                        city_text = city_elem.text
                        # Extraire le nom de la ville (avant le nombre entre parenthèses)
                        city_name = re.sub(r'\s*\(\d+\)\s*$', '', city_text).strip()
                        if city_name:
                            city_names.append(city_name)
                    
                    for city_idx, city_name in enumerate(city_names):
                        if self.state['should_stop']:
                            break
                        
                        while self.state['should_pause']:
                            time.sleep(0.5)
                        
                        task = f"{state} → {city_name}"
                        progress = ((idx * 100 / total_states) + 
                                  ((city_idx + 1) * 100 / total_cities / total_states))
                        
                        self.emit_progress(progress, task)
                        self.scrape_city(state_url, city_name)
                        self.emit_stats()
                    
                    self.emit_log(f"✅ {state} terminé", "success")
                
                except Exception as e:
                    self.emit_log(f"❌ Erreur état {state}: {str(e)}", "error")
                    self.state['stats']['errors'] += 1
            
            if not self.state['should_stop']:
                self.emit_log("\n🎉 Scraping terminé avec succès!", "success")
                self.emit_log(f"📊 Total: {self.state['stats']['kitas']} kitas dans {self.state['stats']['cities']} villes", "info")
                self.state['status'] = 'completed'
                self.socketio.emit('status_update', {'status': 'completed'})
            
        except Exception as e:
            self.emit_log(f"❌ Erreur fatale: {str(e)}", "error")
            self.state['status'] = 'error'
            self.socketio.emit('error', {'type': 'error', 'message': str(e)})
        
        finally:
            if self.driver:
                self.driver.quit()
                self.emit_log("🔌 WebDriver fermé", "info")