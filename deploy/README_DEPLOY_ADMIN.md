# Despliegue Panel Admin Kryotec

## Pasos Rápidos
```
# Preparar directorio
mkdir -p /var/www/admin
cd /var/www/admin

# Clonar repo
git clone https://github.com/JoseeGarciaa/kryotec-Admin.git .

# Crear .env
cp deploy/admin.env.example .env
nano .env  # ajustar valores

# Instalar y build
npm install
npm run build

# Instalar servicio systemd
cp deploy/kryotec-admin.service /etc/systemd/system/kryotec-admin.service
systemctl daemon-reload
systemctl enable kryotec-admin
systemctl start kryotec-admin

# Nginx
cp deploy/nginx-admin.conf.example /etc/nginx/sites-available/admin.kryotecsense.com.conf
ln -s /etc/nginx/sites-available/admin.kryotecsense.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL
certbot --nginx -d admin.kryotecsense.com --redirect
```

## Actualizar
```
bash deploy/deploy-admin.sh
```

## Ver logs
```
journalctl -u kryotec-admin -f
```
