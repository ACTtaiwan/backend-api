source .env

HOST="acttaiwan.azurecr.io"
IMG_TAG="ustw-backend-prod:latest"
USER=$ACR_USER
PASS=$ACR_PASS

echo "[Azure Container Registry] USER=$USER  PASS=$PASS"

docker build -t $IMG_TAG .
docker login $HOST -u $USER -p $PASS
docker tag $IMG_TAG $HOST/$IMG_TAG
docker push $HOST/$IMG_TAG
