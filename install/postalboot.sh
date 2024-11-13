# install docker 
# https://docs.docker.com/get-docker/


  echo ""
  echo "### HO HO HO ! VOUS AVEZ BESOIN D'UN NOUVEAU SERVEUR DE MAIL ? PAS DE PROBLÈME !"
  echo ""
  read -p "> Quel est le nom de domaine lié à ce nouveau serveur ? (krup.nc) " domain
  domain=${domain:-krup.nc} 
  echo "[$domain]"

if [ -f /usr/bin/postal ]
then
  echo ""
  echo "!!! /postal directory already installed"
  echo ">>> skip prerequisites installation"
  echo ""
else
  echo ""
  echo "### START INSTALL prerequisites"
  echo ""

  sudo apt-get update

  sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

  sudo apt install git curl jq

  echo ""
  echo "### START INSTALL DOCKER"
  echo ""

  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

  echo \
    "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null


  sudo apt-get update
  sudo apt-get install docker-ce docker-ce-cli containerd.io


  echo ""
  echo "### DOCKER ENGIGNE INSTALLED"
  echo ""

  echo ""
  echo "### START INSTALL DOCKER COMPOSE"
  echo ""
  #download the current stable release of Docker Compose
  sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  #? sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

  echo ""
  echo "### DOCKER COMPOSE INSTALLED"
  echo ""
  echo "### START INSTALL POSTAL"
  echo ""

  # Git & installation helper repository
  sudo git clone https://postalserver.io/start/install /opt/postal/install
  sudo ln -s /opt/postal/install/bin/postal /usr/bin/postal
fi


sudo docker run -d \
   --name postal-mariadb \
   -p 127.0.0.1:3306:3306 \
   --restart always \
   -e MARIADB_DATABASE=postal \
   -e MARIADB_ROOT_PASSWORD=4Lpz87qjeAguX6hR \
   mariadb

sudo docker run -d \
   --name postal-rabbitmq \
   -p 127.0.0.1:5672:5672 \
   --restart always \
   -e RABBITMQ_DEFAULT_USER=postal \
   -e RABBITMQ_DEFAULT_PASS=9sWGVcvg3VYWeb2d \
   -e RABBITMQ_DEFAULT_VHOST=postal \
   rabbitmq:3.8


echo ""
echo "### START BOOTSTRAP POSTAL $domain"

echo ""
sudo postal bootstrap $domain

echo ""
echo "Bootstrap ok !"
echo "Modifiez les mot de passe ((main_db & message_db) & rabbitmq) : sudo nano /opt/postal/config/postal.yml"
echo "Puis executez ./postalstart.sh"
echo ""

# sudo postal initialize
# sudo postal make-user
# sudo postal start

# checker les spam ?
#https://docs.postalserver.io/features/spam-and-virus-checking

#Doc installation
#https://install.postal.biswajitpradhan.com/