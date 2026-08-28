# Orchid Island — Due Diligence Immobilière & Prédiction de Prix

Projet structuré selon une **architecture 3-Tiers (3 Niveaux)** :

```
due_diligence_project/
│
├── 🎨 1. Frontend/     (React / Vite - Port 5173)
├── ⚙️ 2. Backend/      (Node.js Express / MongoDB - Port 5000)
└── 🤖 3. MlService/    (Python FastAPI / CatBoost - Port 8000)
```

## 📦 Installation complète (après clonage du projet)

### Prérequis

| Outil | Version | Vérification |
|---|---|---|
| [Node.js](https://nodejs.org) | ≥ 18 | `node -v` |
| [Python](https://www.python.org/downloads/) | ≥ 3.11 | `python --version` |

> ℹ️ La base **MongoDB Atlas est distante** : rien à installer localement, mais il faut les identifiants (voir étape 3).

### 1) Cloner le projet
```bash
git clone https://github.com/<ORGANISATION>/<REPO>.git
cd due_dilligence-price_prediction-
```

### 2) Dépendances Node.js (racine + Backend + Frontend)
```bash
npm install                      # racine (concurrently)
cd Backend  && npm install       # API Express + MongoDB
cd ../Frontend && npm install    # React / Vite / Leaflet / Recharts
cd ..
```

### 3) Environnement Python (microservice ML — modèles VENTE & LOCATION)
Le lanceur `npm run dev` attend un venv nommé `.venv` **à la racine** :
```bash
python -m venv .venv
.\.venv\Scripts\pip install -r MlService\requirements.txt
```
> `MlService/requirements.txt` couvre **tout** : FastAPI/uvicorn, CatBoost (modèle Vente), XGBoost + régression quantile (modèles Location), scikit-learn, pandas…

### 4) Variables d'environnement (Backend)
```bash
cp Backend/.env.example Backend/.env
```
Puis éditer `Backend/.env` et renseigner `MONGO_URL` (identifiants Atlas fournis par l'équipe). Ce fichier est ignoré par git — il ne sera jamais commité.

### 5) Données MongoDB
La base distante (`dueDillegenceDB`) contient déjà tout :
- `properties` — annonces Vente + Location (~15 471 annonces location)
- `geo_communes` — polygones des communes
- `dashboard_stats_location` — stats précalculées de la page Analytique (<1 s de chargement)

Aucun import nécessaire au premier lancement. Pour un ré-import des données Location :
```bash
cd Backend
npm run import:location      # nécessite les xlsx sources dans Backend/data/source/
npm run precompute:location  # régénère les stats de la page Analytique
npm run import:geo           # réimporte les polygones communes dans MongoDB
```

---

---

## ⚡ Démarrage en 1 seule commande

À la racine du projet (`due_delligence_project`), lancez simplement :

```bash
npm run dev
```

> **Note** : Cette commande unique démarre simultanément les 3 niveaux avec des logs colorés dans votre terminal :
> * 🤖 **ML Service** : `http://127.0.0.1:8000`
> * ⚙️ **Backend Express** : `http://localhost:5000`
> * 🎨 **Frontend React** : `http://localhost:5173`

---

### Alternative PowerShell (Fenêtres séparées) :

```powershell
.\start-all.ps1
```