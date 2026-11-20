# Sneakers Nico

Appli iPhone pour suivre une collection de sneakers (et d'autres articles : vêtements, accessoires, objets) : valeur estimée de la collection, cote de chaque article avec son historique, photos, simulation de revente et wishlist.

C'est une appli web installable (PWA). Toutes les données restent **sur le téléphone** : aucun compte, aucun serveur.

---

## Installer l'appli sur l'iPhone

1. Ouvrir l'adresse de l'appli dans **Safari** (pas Chrome) : `https://<compte>.github.io/<depot>/`.
2. Toucher le bouton **Partager**, puis **Sur l'écran d'accueil**.
3. Lancer l'appli depuis son icône sur l'écran d'accueil.

> **Important :** utiliser l'appli depuis l'écran d'accueil, pas depuis un onglet Safari. Sinon Safari peut effacer les données d'un site peu visité.

Au premier lancement, les 88 articles de l'Excel d'origine sont importés automatiquement. Ensuite, l'appli fonctionne même sans connexion.

---

## Utilisation

### Collection (accueil)
- La **bulle** affiche la valeur estimée de la collection (cote ajustée selon l'état) et, en petit, la cote brute.
- **Faire défiler** (un swipe, ou un cran de molette sur ordinateur) : la bulle devient l'en-tête et la liste prend tout l'écran. Remonter en haut de la liste et refaire défiler vers le haut pour revenir à la bulle. On peut aussi toucher la bulle ou l'en-tête.
- **Rechercher** par modèle, ligne, marque, SKU ou numéro.
- **Catégories** (Tout, Sneakers, Vêtements…) juste sous la recherche.
- **Filtres** (bouton à droite de la recherche) : marque et état.
- **Tri** : par ligne (groupes Air Max 1, Jordan 1…), par valeur ou par numéro.
- Le bouton **+** ajoute un article.

### Fiche d'un article
- **Photos** : bouton *Photo* (appareil photo) ou icône galerie. Faire glisser pour passer d'une photo à l'autre, icône poubelle pour supprimer celle affichée.
- **Mettre à jour la cote** : ouvrir StockX (ou le lien de cote de l'article), relever le prix, le saisir avec la date. Chaque saisie est gardée et dessine la courbe d'historique.
- **Simuler une revente** : choisir un prix de vente ; l'appli déduit les frais (commission, paiement, envoi) et calcule le profit par rapport au prix d'achat.
- Le crayon en haut à droite permet de **modifier** ou **supprimer** l'article.

### Ajouter ou modifier un article
1. Choisir la **catégorie** : le champ de taille s'adapte (pointure US/FR, taille XS → XXL, dimensions en cm, ou aucune).
2. Choisir **Collection** ou **Wishlist**.
3. Remplir marque, modèle, état, prix… La **ligne** (qui sert au regroupement de la liste) est proposée d'après le modèle et reste modifiable.
4. Pour les pointures : choisir US ou FR, puis − / + ; la conversion s'affiche (grille Nike ou Adidas selon la marque).

### Wishlist
- Ajouter les articles visés avec un **prix cible**.
- Quand la cote passe sous le prix cible, la carte s'entoure du contour coloré : *« Sous ton prix cible : c'est le moment »*.
- **Je l'ai eue** : l'article passe dans la collection (avec le prochain numéro libre) et le formulaire s'ouvre pour compléter le prix d'achat.

### Réglages
- **Sauvegarde** : *Exporter* crée un fichier `.sqlite` (photos comprises) à ranger dans iCloud Drive ; *Importer* remplace toutes les données par celles d'une sauvegarde. Un point orange sur l'onglet Réglages rappelle de sauvegarder (jamais fait ou plus de 30 jours).
- **Catégories** : créer, renommer, changer l'icône et le type de taille, réordonner avec les flèches. Une catégorie qui contient encore des articles ne peut pas être supprimée.
- **Frais de revente** : commission, frais de paiement et frais d'envoi utilisés par le simulateur.
- **Décote selon l'état** : la cote StockX est un prix neuf (DS) ; une paire portée est estimée à un pourcentage de cette cote (90 % pour 9,5/10, puis −8 % par point par défaut).

> **Sauvegarder régulièrement.** Si le téléphone est perdu ou l'appli supprimée de l'écran d'accueil, les données non sauvegardées sont perdues.

---

## Développement

Le code est dans `app/` (Vite, React, TypeScript, Tailwind, SQLite WebAssembly stockée dans le navigateur via OPFS).

```bash
cd app
npm install
npm run dev        # serveur de développement
npx vitest run     # tests (base, import, calculs)
npm run build      # build de production dans app/dist
npm run preview    # sert le build sur http://localhost:4173
```

Organisation :

| Dossier | Contenu |
|---|---|
| `app/src/db/` | Schéma SQLite, requêtes, import initial, worker de la base |
| `app/src/domain/` | Calculs : tailles US/FR, décote et revente, déduction de la ligne |
| `app/src/pages/` | Les écrans (accueil, fiche, formulaire, wishlist, réglages) |
| `app/src/ui/` | Composants et icônes du thème Aurora |

Une fois l'appli en service, ne plus modifier la migration existante dans `app/src/db/schema.ts` : en ajouter une nouvelle à la suite, sinon les données déjà présentes sur le téléphone ne suivront pas.

## Mise en ligne

Chaque envoi sur la branche `main` lance les tests, compile l'appli et la publie sur GitHub Pages (`.github/workflows/deploy.yml`).

Première fois : dans le dépôt GitHub, **Settings > Pages > Source = GitHub Actions**.

Après une mise à jour, l'iPhone récupère la nouvelle version au lancement suivant de l'appli (parfois au deuxième lancement).
