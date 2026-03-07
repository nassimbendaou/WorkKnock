# 🚀 WorkKnock - Déploiement Cloud GRATUIT + Configuration Webhooks

## 📋 Architecture de déploiement (100% gratuit)

| Service | Plateforme | Plan | Limite |
|---------|-----------|------|--------|
| **Backend API** | [Render.com](https://render.com) | Free | 750h/mois, spin down après 15min inactif |
| **Frontend** | [Vercel](https://vercel.com) | Free | 100GB bandwidth/mois |
| **Base MySQL** | [Aiven](https://aiven.io) | Free | 1 Go stockage |
| **Email SMTP** | Gmail | Free | 500 emails/jour |

---

## 🗄️ ÉTAPE 1 : Base de données MySQL gratuite (Aiven)

### 1.1 Créer le compte Aiven
1. Aller sur **https://aiven.io** → **Sign up** (gratuit)
2. Confirmer l'email

### 1.2 Créer un service MySQL
1. Dashboard → **Create service**
2. Choisir **MySQL**
3. Plan : **Free** (Hobbyist)
4. Région : **Google Cloud - europe-west1** (Belgique, proche France)
5. Nom : `workknock-db`
6. Cliquer **Create free service**

### 1.3 Récupérer l'URL de connexion
1. Aller dans votre service MySQL → **Overview**
2. Copier le **Service URI** qui ressemble à :
```
mysql://avnadmin:PASSWORD@mysql-xxx.aiven.io:12345/defaultdb?ssl-mode=REQUIRED
```
3. **GARDER CETTE URL**, vous en aurez besoin pour Render

> 💡 **Alternative** : [TiDB Serverless](https://tidbcloud.com) offre aussi du MySQL gratuit (25 Go !)
> Créer un cluster → copier la connection string MySQL

---

## ⚙️ ÉTAPE 2 : Déployer le Backend sur Render

### 2.1 Préparer le code
1. **Pousser votre code sur GitHub** :
```bash
cd WorkKnock
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE-USER/workknock.git
git push -u origin main
```

### 2.2 Créer le service Render
1. Aller sur **https://render.com** → **Sign up** avec GitHub
2. Dashboard → **New** → **Web Service**
3. Connecter votre repo GitHub `workknock`
4. Configurer :

| Champ | Valeur |
|-------|--------|
| **Name** | `workknock-api` |
| **Region** | `Frankfurt (EU Central)` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm ci && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && node dist/index.js` |
| **Plan** | **Free** |

### 2.3 Variables d'environnement (Render Dashboard)
Aller dans **Environment** → Ajouter ces variables :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `mysql://avnadmin:xxx@mysql-xxx.aiven.io:12345/defaultdb?ssl-mode=REQUIRED` *(l'URL Aiven de l'étape 1)* |
| `JWT_SECRET` | *(cliquer Generate)* |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://workknock.vercel.app` *(à mettre à jour après étape 3)* |

5. Cliquer **Create Web Service**
6. Attendre le déploiement (~3-5 min)
7. Votre API est live sur : **`https://workknock-api.onrender.com`**

> ⚠️ Le plan Free spin-down après 15 min d'inactivité. La première requête prend ~30s pour redémarrer.

### 2.4 Initialiser la base de données
Le `Start Command` exécute automatiquement `prisma migrate deploy`. 
Si c'est la première fois, vous devez créer une migration :

```bash
# Localement, avec DATABASE_URL pointant vers Aiven :
cd backend
DATABASE_URL="mysql://avnadmin:xxx@mysql-xxx.aiven.io:12345/defaultdb?ssl-mode=REQUIRED" npx prisma db push
```

Ou depuis le shell Render (Dashboard → votre service → **Shell**) :
```bash
npx prisma db push
```

---

## 🌐 ÉTAPE 3 : Déployer le Frontend sur Vercel

### 3.1 Installer Vercel CLI (optionnel)
```bash
npm i -g vercel
```

### 3.2 Déployer via le Dashboard Vercel
1. Aller sur **https://vercel.com** → **Sign up** avec GitHub
2. **Add New Project** → Importer le repo `workknock`
3. Configurer :

| Champ | Valeur |
|-------|--------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

4. **Environment Variables** → Ajouter :

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://workknock-api.onrender.com/api` |

5. Cliquer **Deploy**
6. Votre frontend est live sur : **`https://workknock-xxx.vercel.app`**

### 3.3 Mettre à jour le Backend
Retourner dans Render → votre service → **Environment** :
- Mettre `FRONTEND_URL` = `https://workknock-xxx.vercel.app` (l'URL Vercel)
- Cliquer **Save** → le service redémarre automatiquement

---

## 📧 ÉTAPE 4 : Email SMTP gratuit (Gmail)

### 4.1 Créer un mot de passe d'application Gmail
1. Aller sur **https://myaccount.google.com/security**
2. Activer la **Vérification en 2 étapes** si pas déjà fait
3. Aller dans **Mots de passe des applications** (ou chercher "App passwords")
4. **App** : `Mail` / **Appareil** : `Autre` → nommer `WorkKnock`
5. Google génère un mot de passe de 16 caractères → **copier**

### 4.2 Configurer dans Render
Ajouter ces variables d'environnement dans Render :

| Variable | Valeur |
|----------|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `votre-email@gmail.com` |
| `SMTP_PASS` | `le-mot-de-passe-16-chars` |
| `SMTP_FROM` | `WorkKnock <votre-email@gmail.com>` |

---

# 🤖 ÉTAPE 5 : Configuration des Webhooks

Une fois le backend déployé, votre URL de base pour les webhooks est :
```
https://workknock-api.onrender.com/api/webhooks
```

---

## 📱 5A. WhatsApp via Green API (gratuit avec essai)

### Créer le compte
1. Aller sur **https://green-api.com** → **Sign up**
2. Vous obtenez **un essai gratuit** (première instance gratuite pendant 3 jours, puis plan Developer gratuit limité)
3. Dashboard → **Create Instance**
4. Scanner le QR code avec WhatsApp sur votre téléphone
5. Noter :
   - **Instance ID** : `1234567890` (idInstance)
   - **API Token** : `abcdef123456...` (apiTokenInstance)

### Configurer le webhook dans Green API
1. Dashboard Green API → votre instance → **Settings**
2. **Webhook URL** :
```
https://workknock-api.onrender.com/api/webhooks/whatsapp/VOTRE_USER_ID
```
3. Cocher **Incoming Messages** (incomingMessageReceived)
4. Sauvegarder

### Configurer dans Render
Ajouter les variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `WHATSAPP_INSTANCE_ID` | `1234567890` |
| `WHATSAPP_API_TOKEN` | `votre-api-token` |
| `WHATSAPP_API_URL` | `https://api.green-api.com` |

### Configurer dans WorkKnock
1. Se connecter à WorkKnock → **Intégrations** → **WhatsApp**
2. Entrer l'Instance ID et l'API Token
3. Activer l'intégration
4. L'URL webhook est générée automatiquement

### Tester
Envoyer un message WhatsApp au numéro lié à votre instance :
```
/aide
/factures
/ca
/impayes
/conges
/clients
```

### Comment ça marche
```
Vous (WhatsApp) → Green API → POST webhook → Render (backend) → Prisma (DB) → Réponse WhatsApp
```

---

## 🤖 5B. Telegram Bot (100% gratuit)

### Créer le Bot
1. Ouvrir Telegram → chercher **@BotFather**
2. Envoyer `/newbot`
3. Nom du bot : `WorkKnock Bot`
4. Username : `workknock_votrenom_bot`
5. BotFather vous donne un **token** : `123456:ABCdefGhIJKlm...`

### Configurer le Webhook Telegram
Exécuter cette URL dans votre navigateur (remplacer les valeurs) :
```
https://api.telegram.org/bot<VOTRE_TOKEN>/setWebhook?url=https://workknock-api.onrender.com/api/webhooks/telegram/<VOTRE_USER_ID>
```

**Exemple concret :**
```
https://api.telegram.org/bot123456:ABCdefGhIJKlm/setWebhook?url=https://workknock-api.onrender.com/api/webhooks/telegram/clxyz123abc
```

Vous devez obtenir : `{"ok": true, "result": true, "description": "Webhook was set"}`

### Vérifier le webhook
```
https://api.telegram.org/bot<VOTRE_TOKEN>/getWebhookInfo
```

### Configurer dans Render
| Variable | Valeur |
|----------|--------|
| `TELEGRAM_BOT_TOKEN` | `123456:ABCdefGhIJKlm...` |

### Configurer dans WorkKnock
1. **Intégrations** → **Telegram** → Entrer le Bot Token
2. Activer

### Tester
Ouvrir Telegram → chercher votre bot → envoyer :
```
/start
/factures
/facture FAC-001
/ca
/ca 2025
/impayes
/conges
/clients
```

> 💡 Le bot Telegram peut envoyer les PDF des factures directement dans le chat !

---

## 💬 5C. Slack App (gratuit)

### Créer l'App Slack
1. Aller sur **https://api.slack.com/apps** → **Create New App**
2. Choisir **From scratch**
3. Nom : `WorkKnock` / Workspace : votre workspace
4. Cliquer **Create App**

### Configurer les Slash Commands
1. Menu gauche → **Slash Commands** → **Create New Command**
2. Créer ces 3 commandes :

| Command | Request URL | Description |
|---------|------------|-------------|
| `/workknock-factures` | `https://workknock-api.onrender.com/api/webhooks/slack/VOTRE_USER_ID` | Liste des factures |
| `/workknock-ca` | `https://workknock-api.onrender.com/api/webhooks/slack/VOTRE_USER_ID` | Chiffre d'affaires |
| `/workknock-impayes` | `https://workknock-api.onrender.com/api/webhooks/slack/VOTRE_USER_ID` | Factures impayées |

### Configurer les permissions (OAuth & Permissions)
1. Menu gauche → **OAuth & Permissions**
2. **Scopes** → **Bot Token Scopes** → Ajouter :
   - `chat:write`
   - `commands`
3. **Install to Workspace** → Authorize
4. Copier le **Bot User OAuth Token** : `xoxb-xxx-xxx-xxx`

### Récupérer le Signing Secret
1. Menu gauche → **Basic Information**
2. Copier le **Signing Secret**

### Configurer dans Render
| Variable | Valeur |
|----------|--------|
| `SLACK_BOT_TOKEN` | `xoxb-xxx-xxx-xxx` |
| `SLACK_SIGNING_SECRET` | `votre-signing-secret` |

### Tester
Dans Slack, taper :
```
/workknock-factures
/workknock-factures NomClient
/workknock-ca
/workknock-ca 2025
/workknock-impayes
```

---

## 🟦 5D. Microsoft Teams (gratuit avec compte Microsoft)

### Option 1 : Incoming Webhook (le plus simple)
1. Dans Teams → choisir un canal
2. **⋯** → **Connectors** (ou **Workflows** dans le nouveau Teams)
3. Chercher **Incoming Webhook** → **Configure**
4. Nom : `WorkKnock` → **Create**
5. Copier l'URL du webhook : `https://xxx.webhook.office.com/webhookb2/xxx`

### Configurer dans WorkKnock
1. **Intégrations** → **Teams**
2. Coller l'URL du webhook
3. Activer

### Option 2 : Bot Framework (plus avancé)
1. Aller sur **https://dev.botframework.com/bots/new**
2. Créer un bot avec :
   - **Messaging endpoint** : `https://workknock-api.onrender.com/api/webhooks/teams/VOTRE_USER_ID`
3. Récupérer l'**App ID** et le **Password**

### Configurer dans Render
| Variable | Valeur |
|----------|--------|
| `TEAMS_APP_ID` | `votre-app-id` |
| `TEAMS_APP_PASSWORD` | `votre-app-password` |

### Tester
Dans le canal Teams, envoyer :
```
factures
ca
impayes
```
Le bot répond avec des **Adaptive Cards** formatées.

---

## 🔑 ÉTAPE 6 : Trouver votre USER_ID

Le `USER_ID` est nécessaire dans les URLs webhook. Pour le trouver :

### Méthode 1 : Via l'API
Après vous être inscrit sur WorkKnock, appelez :
```bash
curl https://workknock-api.onrender.com/api/auth/me \
  -H "Authorization: Bearer VOTRE_JWT_TOKEN"
```
La réponse contient votre `id` (ex: `clxyz123abc456`).

### Méthode 2 : Via la base de données
Depuis le shell Render ou votre client MySQL :
```sql
SELECT id, email FROM users;
```

### Méthode 3 : Via le navigateur
1. Se connecter à WorkKnock
2. Ouvrir les DevTools (F12) → Console
3. Taper : `JSON.parse(localStorage.getItem('wk_user')).id`

---

## 📊 Résumé des URLs

Après déploiement, vos URLs sont :

| Service | URL |
|---------|-----|
| **Frontend** | `https://workknock-xxx.vercel.app` |
| **API** | `https://workknock-api.onrender.com/api` |
| **Health** | `https://workknock-api.onrender.com/health` |
| **WhatsApp Webhook** | `https://workknock-api.onrender.com/api/webhooks/whatsapp/{userId}` |
| **Telegram Webhook** | `https://workknock-api.onrender.com/api/webhooks/telegram/{userId}` |
| **Slack Webhook** | `https://workknock-api.onrender.com/api/webhooks/slack/{userId}` |
| **Teams Webhook** | `https://workknock-api.onrender.com/api/webhooks/teams/{userId}` |

---

## 🐛 Dépannage

### Le backend ne démarre pas
- Vérifier les logs dans Render → **Logs**
- Vérifier que `DATABASE_URL` est correct et inclut `?ssl-mode=REQUIRED`

### La base de données ne se connecte pas
- Aiven nécessite SSL. Vérifier que l'URL contient `?ssl-mode=REQUIRED`
- Vérifier que l'IP de Render n'est pas bloquée (Aiven → **Allowed IP Addresses** → ajouter `0.0.0.0/0`)

### Le frontend n'atteint pas l'API
- Vérifier `VITE_API_URL` dans Vercel (doit inclure `/api`)
- Vérifier `FRONTEND_URL` dans Render (doit correspondre au domaine Vercel)

### Webhook Telegram ne fonctionne pas
- Vérifier : `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Le champ `last_error_message` indique le problème
- Si "connection timed out" → le backend est en spin-down, envoyer d'abord une requête au health check

### WhatsApp ne répond pas
- Vérifier dans Green API que l'instance est connectée (QR code scanné)
- Vérifier que le webhook URL est correct dans les settings Green API
- Tester manuellement : `curl -X POST https://workknock-api.onrender.com/api/webhooks/whatsapp/VOTRE_ID`

### Slack renvoie "dispatch_failed"
- Les slash commands Slack ont un timeout de 3s
- Le plan Free de Render peut mettre 30s à se réveiller
- Solution : garder le backend actif avec un ping cron gratuit (voir ci-dessous)

---

## ⏰ Garder le backend actif (anti-spin-down)

Le plan gratuit de Render éteint le service après 15 min d'inactivité.
Pour les webhooks, c'est problématique. Solution gratuite :

### Utiliser UptimeRobot (gratuit)
1. Aller sur **https://uptimerobot.com** → créer un compte gratuit
2. **Add New Monitor** :
   - Type : **HTTP(s)**
   - URL : `https://workknock-api.onrender.com/health`
   - Interval : **5 minutes**
3. Cela ping votre backend toutes les 5 min → il reste actif

> ⚠️ Render donne 750h gratuites/mois. Un service actif 24/7 = 720h/mois → ça passe !

---

## ✅ Checklist finale

- [ ] Base MySQL créée sur Aiven (ou TiDB)
- [ ] Backend déployé sur Render
- [ ] `DATABASE_URL` configuré dans Render
- [ ] `prisma db push` exécuté
- [ ] Frontend déployé sur Vercel
- [ ] `VITE_API_URL` configuré dans Vercel
- [ ] `FRONTEND_URL` mis à jour dans Render
- [ ] Compte créé sur WorkKnock
- [ ] `USER_ID` récupéré
- [ ] Gmail App Password créé pour SMTP
- [ ] UptimeRobot configuré (anti-spin-down)
- [ ] (Optionnel) Telegram bot créé + webhook configuré
- [ ] (Optionnel) WhatsApp Green API configuré
- [ ] (Optionnel) Slack App créée + slash commands
- [ ] (Optionnel) Teams webhook configuré
