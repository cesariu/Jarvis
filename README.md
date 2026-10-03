# JARVIS Tablet V0.3 — installation simple

Cette version a été reconstruite autour de la tablette : une PWA installable avec bouton **Installer JARVIS** et cerveau local optionnel.

## Ce qui fonctionne
- PWA installable depuis une adresse HTTPS.
- Visage holographique : toucher = démarrer/arrêter l'écoute.
- Reconnaissance vocale française si le navigateur la fournit.
- Synthèse vocale avec choix de voix et vitesse.
- Chat texte.
- Mémoire locale contrôlée par Fred (ajout, consultation, export, suppression).
- Modèle open source dans le navigateur via WebLLM/WebGPU : aucune clé OpenAI requise.
- Historique local.
- Interface responsive tablette/téléphone/PC.
- Service worker pour la coque de l'application.

## Important
Une PWA ne peut pas être installée correctement en ouvrant directement `index.html` avec `file://`. Elle doit être ouverte depuis **HTTPS** (ou localhost pendant le développement). Le but est donc de publier ce dossier une seule fois sur un hébergeur statique. Après cela, Fred ouvre l'adresse sur la Galaxy Tab, touche **Installer JARVIS**, et l'icône apparaît sur l'écran d'accueil.

Le premier chargement du cerveau local nécessite Internet et peut télécharger un modèle volumineux. WebLLM utilise WebGPU et met en cache le modèle dans le navigateur quand cela est supporté.

## Installation sur Galaxy Tab
1. Publier le contenu de ce dossier sur un hébergement HTTPS (GitHub Pages, Cloudflare Pages, Netlify, etc.).
2. Ouvrir l'URL avec Chrome ou Samsung Internet.
3. Appuyer sur **Installer JARVIS**. Si Android ne présente pas la boîte d'installation, utiliser le menu du navigateur > **Installer l'application** / **Ajouter à l'écran d'accueil**.
4. Ouvrir JARVIS depuis son icône.
5. Appuyer une fois sur **Activer le cerveau local**. Préférer le Wi‑Fi lors du premier téléchargement.
6. Toucher le visage holographique pour parler.

## Limites V0.3
- La mémoire est locale à chaque appareil, pas encore synchronisée.
- Web/OSINT/Images sont volontairement désactivés : aucune fonction factice.
- La reconnaissance vocale dépend du navigateur et peut utiliser le service vocal fourni par celui-ci.
- Les performances du modèle local dépendent de WebGPU, de la mémoire et du GPU de l'appareil.

## Suite V0.4
- synchronisation chiffrée multi-appareils ;
- Web et OSINT réels ;
- analyse d'images/OCR ;
- registre d'outils JARVIS CORE ;
- automatisations serveur optionnelles pour les tâches qui doivent tourner appareil éteint.
