## Clone the project
```
git clone https://gitlab.com/krup1/krup-api
```

## Project setup
```
npm install
```

---
## Run server (avec config/default.json)
```
node app.js
```

---
## Run server (avec config/production.json)
Pour utiliser le fichier de config production.json, il faut rajouter NODE_ENV=production avant la commande
```
NODE_ENV=production node app.js
```

Le serveur est lancé sur le port indiqué dans le fichier de config production.json (paramètre "port")
Lorsque le serveur est lancé, vous pouvez vérifier qu'il fonctionne en vous rendant à l'adresse suivante : 

http://localhost:5001/admin/api-ready (remplacer par le port indiqué en config)

Ou en utilisant votre IP locale, ex : (remplacer 192.168.0.6 par votre adresse IP ou votre nom de domaine)

http://192.168.0.6:5001/admin/api-ready


> Dans le cas où le client ne pourrait pas accéder à l'API à cause d'une erreur CORS, modifiez l'attribut "allow_origin" dans le fichier de configuration de l'API /config/default.json, pour indiquer l'adresse IP utilisée par le client pour se connecter à l'API


---
## Configuration

Description des principaux paramètres du fichier de configuration :

| Paramètre | Valeur | Détails |
| ------ | ------ | ------ |
| domainName | krup.nc | Le nom de domaine du site lié à cet API (utilisé uniquement pour gérer les statistiques du site) |
| domainUrlClient | https://krup.nc | URL complète du site accessible aux utilisateurs (utilisé pour générer les liens vers le site dans les emails) |
| domainUrlApiProd | https://api.krup.nc | URL complète vers l'API (utilisé pour les liens vers des images dans les emails) |
| port | 5001 | Le port sur lequel est lancée l'API en local |
| portSocket | 5002 | Le port sur lequel est lancée le serveur de socket en local |
| db_url | mongodb://localhost:27017/ | L'url pour se connecter à la base de donnée Mongo |
| db_name | krup | Le nom de la base de donnée Mongo |
| access_pk | ZmU2NjhiO... | Clé unique utilisée pour l'encodage des mots de passe utilisateurs |
| root_pk | FkN2UiLCp... | Clé unique utilisée pour pour permettre aux CRON de s'identifier pour accéder à l'API |
| allow_origin | \[ "https://krup.nc", "https://admin.krup.nc" ] | Liste des url autorisées à accéder à l'API (array) |

Dans le cas d'utilisation d'un Proxy, les paramètres "port" et "portSocket" correspondent aux ports utilisés en local sur le serveur, derrière le proxy.

Il faut donc utiliser le Proxy pour rediriger le trafic vers ces ports (par exemple 5001 et 5002, mais n'importe quels autres ports peuvent-être utilisés)

Pour l'exemple, voici la configuration utilisée sur le serveur de production d'Otomony.fr : (ports 4001 et 4002)

config/production.json : 
```
  "domainUrlName" : "otomony.fr",
  "domainUrlClient": "https://otomony.fr",
  "domainUrlApiProd" : "https://api.otomony.fr",
  "port": 4001,
  "portSocket": 4002,
```

Fichier de configuration du proxy (Caddy https://caddyserver.com/docs/) : 

```
otomony.fr {
        reverse_proxy 127.0.0.1:4000
        reverse_proxy /socket.io/* 127.0.0.1:4002
}

api.otomony.fr {
        reverse_proxy 127.0.0.1:4001
}

admin.otomony.fr {
        reverse_proxy 127.0.0.1:4100
}
```




