-- D1 / stats_db : schéma actuel (tu l'as montré)
-- clicks(id INTEGER PK, campaign TEXT NOT NULL, created_at TEXT NOT NULL)

-- 1) Ajoute les colonnes pour avoir la provenance (SMS/Facebook/QR), + infos utiles
ALTER TABLE clicks ADD COLUMN source TEXT;
ALTER TABLE clicks ADD COLUMN referrer TEXT;
ALTER TABLE clicks ADD COLUMN ua TEXT;
ALTER TABLE clicks ADD COLUMN country TEXT;

-- 2) Voir les derniers clics (date/heure)
SELECT id, campaign, source, created_at, country
FROM clicks
ORDER BY id DESC
LIMIT 50;

-- 3) Total clics
SELECT COUNT(*) AS total FROM clicks;

-- 4) Clics aujourd'hui
SELECT COUNT(*) AS today
FROM clicks
WHERE date(created_at) = date('now');

-- 5) Répartition par campagne
SELECT campaign, COUNT(*) AS n
FROM clicks
GROUP BY campaign
ORDER BY n DESC;

-- 6) Répartition par source (sms/facebook/qr/...)
SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS n
FROM clicks
GROUP BY source
ORDER BY n DESC;

-- 7) Aujourd'hui par heure
SELECT strftime('%H', created_at) AS hour, COUNT(*) AS n
FROM clicks
WHERE date(created_at) = date('now')
GROUP BY hour
ORDER BY hour;
