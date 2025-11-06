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
from selenium.common.exceptions import NoSuchElementException, TimeoutException
import re
import math

class KitaScraper:
    def __init__(self, states, settings, socketio, scraping_state):
        self.states = states
        self.settings = settings
        self.socketio = socketio
        self.state = scraping_state
        self.driver = None
        
        # Pages alphabétiques pour la pagination
        self.alphabet_pages = ['aä', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'ij', 'k', 'l', 'm', 'n', 'oö', 'pq', 'r', 's', 'tuü', 'vw', 'xyz']
        
    def emit_log(self, message, level='info'):
        """Envoyer un log au frontend"""
        self.socketio.emit('log', {
            'type': 'log',
            'message': message,
            'level': level
        })
        print(f"[{level.upper()}] {message}")
    
    def emit_progress(self, progress, task):
        """Mettre à jour la progression avec plus de précision"""
        # Calculer le pourcentage global
        total_progress = 0
        
        if self.state['stats']['kitas'] > 0:
            # Calculer sur la base des kitas trouvées
            estimated_total = self.state['stats']['kitas'] * (len(self.states) / max(1, len(self.state['data'])))
            total_progress = min(95, (len(self.state['data']) / max(1, estimated_total)) * 100)
        else:
            # Calculer sur la base des états
            states_progress = (progress / len(self.states)) * 100
            total_progress = min(95, states_progress)

        self.state['progress'] = round(total_progress, 1)
        self.state['current_task'] = f"{task} ({self.state['stats']['kitas']} kitas)"

        # Émettre plus d'informations pour le frontend
        self.socketio.emit('progress_update', {
            'progress': total_progress,
            'task': self.state['current_task'],
            'stats': self.state['stats'],
            'current_state': task,
            'total_states': len(self.states),
            'processed_kitas': len(self.state['data']),
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
            self.emit_log("🔧 Configuration du WebDriver...", "info")
            
            options = Options()
            
            # CORRECTION 1: Désactiver headless pour voir ce qui se passe
            if self.settings.get('headless', False):
                options.add_argument("--headless=new")
            
            # CORRECTION 2: Options pour éviter les erreurs SSL
            options.add_argument("--ignore-certificate-errors")
            options.add_argument("--ignore-ssl-errors")
            options.add_argument("--allow-insecure-localhost")
            
            # Options standards
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--disable-blink-features=AutomationControlled")
            
            # CORRECTION 3: User agent récent et valide
            options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
            
            # CORRECTION 4: Désactiver les fonctionnalités qui peuvent bloquer
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # CORRECTION 5: Préférences pour désactiver les avertissements de sécurité
            prefs = {
                "profile.default_content_setting_values.notifications": 2,
                "credentials_enable_service": False,
                "profile.password_manager_enabled": False
            }
            options.add_experimental_option("prefs", prefs)
            
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=options)
            
            # CORRECTION 6: Supprimer les propriétés webdriver
            self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                "userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            })
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            self.emit_log("✅ WebDriver initialisé", "success")
            return True
            
        except Exception as e:
            self.emit_log(f"❌ Erreur WebDriver: {str(e)}", "error")
            return False
    
    def get_state_url_slug(self, state):
        """Convertir le nom d'état en slug URL correct pour kita.de"""
        # Mapping exact des états allemands vers leurs slugs URL
        state_url_map = {
            'Baden-Württemberg': 'baden-wuerttemberg',
            'Bayern': 'bayern',
            'Berlin': 'berlin',
            'Brandenburg': 'brandenburg',
            'Bremen': 'bremen',
            'Hamburg': 'hamburg',
            'Hessen': 'hessen',
            'Mecklenburg-Vorpommern': 'mecklenburg-vorpommern',
            'Niedersachsen': 'niedersachsen',
            'Nordrhein-Westfalen': 'nordrhein-westfalen',
            'Rheinland-Pfalz': 'rheinland-pfalz',
            'Saarland': 'saarland',
            'Sachsen': 'sachsen',
            'Sachsen-Anhalt': 'sachsen-anhalt',
            'Schleswig-Holstein': 'schleswig-holstein',
            'Thüringen': 'thueringen'
        }
        
        # Retourner le slug ou convertir en minuscules avec translittération de base
        if state in state_url_map:
            return state_url_map[state]
        
        # Fallback: translittération simple
        slug = state.lower()
        translit = {
            'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
            'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue'
        }
        for char, replacement in translit.items():
            slug = slug.replace(char, replacement)
        
        return slug
    
    def extract_city_and_kitas(self, text):
        """Extraire ville et nombre de kitas du format 'Ville (123)'"""
        pattern = r"^(.*?)\s*\((\d+)\)$"
        match = re.match(pattern, text)
        if match:
            city = match.group(1).strip()
            kitas = int(match.group(2))
            return city, kitas
        return text.strip(), 0
    
    def extract_detail_info(self, kita_url):
        """Extraire les informations détaillées d'une page Kita"""
        retry_count = 0
        max_retries = 3
        
        while retry_count < max_retries:
            try:
                self.driver.get(kita_url)
                time.sleep(2)  # Attendre le chargement complet
                
                detail_info = {
                    'phone': None,
                    'email': None,
                    'website': None,
                    'description': None
                }
                
                # Extraire l'email 
                try:
                    WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'mailto:')]"))
                    )
                    email_elem = self.driver.find_element(By.XPATH, "//a[contains(@href, 'mailto:')]")
                    email_text = email_elem.get_attribute('href').replace('mailto:', '')
                    detail_info['email'] = email_text.strip()
                    self.emit_log(f"      📧 Email trouvé: {email_text.strip()}", "success")
                except:
                    self.emit_log("      ℹ️ Pas d'email trouvé", "info")
                
                # Extraire le téléphone 
                try:
                    phone_elem = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.XPATH, "//a[contains(@href, 'tel:')] | //p[contains(@class, 'phone')]"))
                    )
                    phone_text = phone_elem.text.replace('Telefon:', '').strip()
                    if phone_text:
                        detail_info['phone'] = phone_text
                        self.emit_log(f"      📞 Téléphone trouvé: {phone_text}", "success")
                except:
                    self.emit_log("      ℹ️ Pas de téléphone trouvé", "info")
                
                # Extraire le site web 
                try:
                    website_elem = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "p.www a"))
                    )
                    website_url = website_elem.get_attribute('href')
                    if website_url and 'kita.de' not in website_url:
                        detail_info['website'] = website_url
                        self.emit_log(f"      🌐 Site web trouvé: {website_url}", "success")
                except:
                    self.emit_log("      ℹ️ Pas de site web trouvé", "info")
                
                return detail_info
                
            except Exception as e:
                retry_count += 1
                if retry_count < max_retries:
                    self.emit_log(f"      ⚠️ Tentative {retry_count}/{max_retries} échouée, nouvelle tentative...", "warning")
                    time.sleep(2)
                else:
                    self.emit_log(f"      ❌ Échec de l'extraction des détails après {max_retries} tentatives", "error")
                    return {
                        'phone': None,
                        'email': None,
                        'website': None,
                        'description': None
                    }
    
    def scrape_city_page(self, city_url, page_num, state_name):
        """Scraper une page d'une ville"""
        kitas = []
        
        try:
            page_url = f"{city_url}/p={page_num}" if page_num > 1 else city_url
            self.driver.get(page_url)
            time.sleep(self.settings.get('delay', 500) / 1000)
            
            # Attendre que le contenu se charge
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "profile_listing"))
                )
            except TimeoutException:
                self.emit_log(f"      ⏱️ Timeout page {page_num}", "warning")
                return kitas
            
            listing = self.driver.find_element(By.CLASS_NAME, "profile_listing")
            items = listing.find_elements(By.CLASS_NAME, "media")
            
            self.emit_log(f"      📋 Page {page_num}: {len(items)} kitas", "info")
            
            for item in items:
                try:
                    # Nom et lien
                    link_elem = item.find_element(By.XPATH, ".//h3/a")
                    name = link_elem.text.strip()
                    kita_href = link_elem.get_attribute('href')
                    kita_id = kita_href.split('/')[-1]
                    
                    # Adresse
                    address_elem = item.find_element(By.XPATH, ".//p/small")
                    address_html = address_elem.get_attribute('innerHTML')
                    parts = [p.strip() for p in address_html.split("<br>")]
                    
                    street = parts[0] if len(parts) >= 1 else ""
                    postal_code = ""
                    city = ""
                    state = state_name
                    
                    if len(parts) >= 2:
                        postal_parts = parts[1].strip().split()
                        if len(postal_parts) >= 1:
                            postal_code = postal_parts[0]
                        if len(postal_parts) > 1:
                            city = " ".join(postal_parts[1:])
                    
                    if len(parts) >= 3:
                        state = parts[2].strip()
                    
                    # Créer l'objet
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
                    
                    # Extraire les détails si demandé
                    if self.settings.get('extract_details', False):
                        detail_info = self.extract_detail_info(kita_href)
                        kita_data.update(detail_info)
                        # Retour à la page de listing
                        self.driver.get(page_url)
                        time.sleep(0.5)
                    
                    kitas.append(kita_data)
                    self.state['stats']['kitas'] += 1
                
                except Exception as e:
                    self.emit_log(f"        ⚠️ Erreur élément: {str(e)}", "warning")
                    self.state['stats']['errors'] += 1
        
        except Exception as e:
            self.emit_log(f"      ❌ Erreur page {page_num}: {str(e)}", "error")
        
        return kitas
    
    def scrape_city(self, state_url, city_name, city_link):
        """Scraper toutes les pages d'une ville"""
        try:
            self.emit_log(f"    🏙️ {city_name}", "info")
            
            # Aller sur la première page de la ville
            self.driver.get(city_link)
            time.sleep(1)
            
            # Obtenir le nombre de pages
            html = self.driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            
            pages = 1
            pagination = soup.find("ul", class_="pagination list-unstyled")
            if pagination:
                page_links = pagination.find_all("a")
                if page_links:
                    try:
                        last_href = page_links[-1].get("href", "")
                        match = re.search(r'p=(\d+)', last_href)
                        if match:
                            pages = int(match.group(1))
                    except:
                        pass
            
            self.emit_log(f"      📖 {pages} page(s) à traiter", "info")
            
            all_kitas = []
            for page in range(1, pages + 1):
                if self.state['should_stop']:
                    break
                
                while self.state['should_pause']:
                    time.sleep(0.5)
                
                kitas = self.scrape_city_page(city_link, page, state_url.split('/')[-1])
                all_kitas.extend(kitas)
            
            if all_kitas:
                self.emit_log(f"    ✅ {len(all_kitas)} kitas collectées", "success")
                self.emit_data(all_kitas)
                self.state['stats']['cities'] += 1
            
            return all_kitas
            
        except Exception as e:
            self.emit_log(f"    ❌ Erreur ville {city_name}: {str(e)}", "error")
            self.state['stats']['errors'] += 1
            return []
    
    def scrape_state(self, state):
        """Scraper un état complet"""
        try:
            base_url = "https://www.kita.de/kitas"
            state_slug = self.get_state_url_slug(state)
            state_url = f"{base_url}/{state_slug}"
            
            self.emit_log(f"\n{'='*60}", "info")
            self.emit_log(f"📂 ÉTAT: {state}", "info")
            self.emit_log(f"{'='*60}", "info")
            
            # Charger la page avec retry et vérification
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    self.emit_log(f"  🌐 Chargement {state_url} (tentative {attempt + 1}/{max_retries})", "info")
                    self.driver.get(state_url)
                    
                    # Vérifier qu'on n'est pas sur une page d'erreur
                    time.sleep(2)
                    page_title = self.driver.title
                    current_url = self.driver.current_url
                    
                    self.emit_log(f"  📄 Titre: {page_title}", "info")
                    self.emit_log(f"  🔗 URL: {current_url}", "info")
                    
                    # Vérifier si c'est une page d'erreur
                    if "Privacy error" in page_title or "SSL" in page_title or "certificate" in page_title.lower():
                        self.emit_log(f"  ⚠️ Page d'erreur SSL détectée, nouvelle tentative...", "warning")
                        time.sleep(3)
                        continue
                    
                    # Vérifier si on a du contenu valide
                    html = self.driver.page_source
                    if "ssl-enhanced-protection-message" in html or "error-code" in html:
                        self.emit_log(f"  ⚠️ HTML d'erreur détecté, nouvelle tentative...", "warning")
                        time.sleep(3)
                        continue
                    
                    # Si on arrive ici, la page semble OK
                    self.emit_log(f"  ✅ Page chargée avec succès", "success")
                    break
                    
                except Exception as e:
                    self.emit_log(f"  ❌ Erreur tentative {attempt + 1}: {str(e)}", "error")
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(3)
            
            # ATTENDRE que le contenu JavaScript se charge
            self.emit_log("  ⏳ Attente du chargement JavaScript...", "info")
            try:
                # Attendre que la liste des villes apparaisse (jusqu'à 20 secondes)
                WebDriverWait(self.driver, 20).until(
                    lambda driver: len(driver.find_elements(By.CSS_SELECTOR, ".cities li a")) > 0 or 
                                 driver.find_element(By.CSS_SELECTOR, ".pagination_char")
                )
                time.sleep(2)
                self.emit_log("  ✅ Contenu chargé", "success")
            except TimeoutException:
                self.emit_log("  ⚠️ Timeout - tentative de scraping quand même", "warning")
            
            html = self.driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            
            self.emit_log(f"  📄 HTML chargé ({len(html)} caractères)", "info")
            
            # Vérifier si pagination alphabétique existe
            pagination_alpha = soup.find("ol", class_="pagination_char list-unstyled")
            
            all_cities = []
            
            if pagination_alpha:
                # AVEC pagination alphabétique
                self.emit_log("  📚 Pagination alphabétique détectée", "info")
                
                for letter in self.alphabet_pages:
                    if self.state['should_stop']:
                        break
                    
                    alpha_url = f"{state_url}/c={letter}"
                    self.emit_log(f"\n  📖 Lettre: {letter}", "info")
                    
                    self.driver.get(alpha_url)
                    
                    # Attendre le chargement
                    try:
                        WebDriverWait(self.driver, 10).until(
                            EC.presence_of_element_located((By.CLASS_NAME, "cities"))
                        )
                        time.sleep(1)
                    except TimeoutException:
                        self.emit_log(f"    ⏱️ Timeout lettre {letter}", "warning")
                        continue
                    
                    html = self.driver.page_source
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Trouver les villes
                    cities_list = soup.find("ol", class_="cities list-unstyled")
                    if not cities_list:
                        cities_list = soup.find("ul", class_="cities")
                    
                    if cities_list:
                        city_items = cities_list.find_all("li")
                        self.emit_log(f"    🏙️ {len(city_items)} ville(s) trouvée(s)", "info")
                        
                        for city_item in city_items:
                            city_link_elem = city_item.find("a")
                            if not city_link_elem:
                                continue
                            
                            city_text = city_item.get_text(strip=True)
                            city_name, kita_count = self.extract_city_and_kitas(city_text)
                            city_link = "https://www.kita.de" + city_link_elem.get("href")
                            
                            all_cities.append({
                                'name': city_name,
                                'link': city_link,
                                'count': kita_count
                            })
            
            else:
                # SANS pagination alphabétique
                self.emit_log("  📍 Pas de pagination alphabétique", "info")
                
                # Utiliser Selenium directement
                self.emit_log("  🔄 Utilisation de Selenium pour extraire les villes...", "info")
                try:
                    # Attendre les éléments de ville
                    WebDriverWait(self.driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".cities li a"))
                    )
                    
                    city_elements = self.driver.find_elements(By.CSS_SELECTOR, ".cities li")
                    
                    if city_elements:
                        self.emit_log(f"  🏙️ {len(city_elements)} ville(s) trouvée(s) avec Selenium", "info")
                        
                        for city_elem in city_elements:
                            try:
                                city_link_elem = city_elem.find_element(By.TAG_NAME, "a")
                                city_text = city_elem.text
                                city_name, kita_count = self.extract_city_and_kitas(city_text)
                                city_href = city_link_elem.get_attribute("href")
                                
                                all_cities.append({
                                    'name': city_name,
                                    'link': city_href,
                                    'count': kita_count
                                })
                            except:
                                pass
                    else:
                        self.emit_log("  ❌ Aucune ville trouvée!", "error")
                        # Screenshot pour debug
                        try:
                            screenshot_path = f"debug_screenshot_{state}.png"
                            self.driver.save_screenshot(screenshot_path)
                            self.emit_log(f"  📸 Screenshot sauvegardé: {screenshot_path}", "info")
                        except:
                            pass
                        
                except Exception as e:
                    self.emit_log(f"  ⚠️ Erreur Selenium: {str(e)}", "warning")
            
            # Scraper toutes les villes trouvées
            total_cities = len(all_cities)
            self.emit_log(f"\n  ✅ Total: {total_cities} ville(s) à scraper", "info")
            
            for idx, city_info in enumerate(all_cities):
                if self.state['should_stop']:
                    break
                
                while self.state['should_pause']:
                    time.sleep(0.5)
                
                self.scrape_city(state_url, city_info['name'], city_info['link'])
                self.emit_stats()
            
            self.emit_log(f"\n✅ État {state} terminé", "success")
            
        except Exception as e:
            self.emit_log(f"❌ Erreur état {state}: {str(e)}", "error")
            import traceback
            self.emit_log(f"Traceback: {traceback.format_exc()}", "error")
    
    def run(self):
        """Exécuter le scraping"""
        try:
            self.emit_log("="*60, "info")
            self.emit_log("🚀 DÉMARRAGE DU SCRAPING KITA.DE", "info")
            self.emit_log("="*60, "info")
            
            if not self.setup_driver():
                return
            
            total_states = len(self.states)
            
            for idx, state in enumerate(self.states):
                if self.state['should_stop']:
                    break
                
                progress = (idx / total_states) * 100
                self.emit_progress(progress, f"État {idx+1}/{total_states}: {state}")
                
                self.scrape_state(state)
            
            if not self.state['should_stop']:
                self.emit_log("\n" + "="*60, "info")
                self.emit_log("🎉 SCRAPING TERMINÉ !", "success")
                self.emit_log("="*60, "info")
                self.emit_log(f"📊 Kitas: {self.state['stats']['kitas']}", "info")
                self.emit_log(f"📍 Villes: {self.state['stats']['cities']}", "info")
                self.emit_log(f"⚠️ Erreurs: {self.state['stats']['errors']}", "info")
                self.state['status'] = 'completed'
                self.socketio.emit('status_update', {'status': 'completed'})
                self.emit_progress(100, "Terminé")
            
        except Exception as e:
            self.emit_log(f"❌ ERREUR: {str(e)}", "error")
            import traceback
            self.emit_log(f"{traceback.format_exc()}", "error")
            self.state['status'] = 'error'
        
        finally:
            if self.driver:
                self.driver.quit()
                self.emit_log("🔌 WebDriver fermé", "info")