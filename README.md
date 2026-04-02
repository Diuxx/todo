ng new life-leveling --routing --style=scss --ssr=false
npm i bootstrap @popperjs/core
npm i chart.js
npm i bootstrap-icons

todo: install ng2-charts


-- installer capacitor dans le projet.
npm i @capacitor/core
npm i -D @capacitor/cli

-- init capacitor
npx cap init

-- ajouter le code android (android studio)
npm i @capacitor/android
npx cap add android

-- syncro le front et android  <!>
npx cap sync android

-- mise en place de logo (créer un dossier resources à la racine du projet.)
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --android (génére toutes les definitions)

