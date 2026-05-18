pipeline {
  agent any

  environment {
    REGISTRY_URL = credentials('REGISTRY_URL')
    IMAGE_TAG    = "${env.BUILD_NUMBER}"
    DEPLOY_DIR   = '/volume1/docker/evoke-sync'
    COMPOSE_FILE = 'docker-compose.prod.yml'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  stages {
    stage('Preflight') {
      steps {
        script {
          sh 'docker info > /dev/null 2>&1 || { echo "ERROR: Docker not accessible. Mount /var/run/docker.sock into Jenkins container."; exit 1; }'
          sh 'curl -sf http://${REGISTRY_URL}/v2/ > /dev/null || { echo "ERROR: Registry at ${REGISTRY_URL} is not reachable. Check insecure-registries config."; exit 1; }'
          sh 'test -f ${DEPLOY_DIR}/.env || { echo "ERROR: ${DEPLOY_DIR}/.env not found. Create it on the NAS before running the pipeline."; exit 1; }'
          sh 'docker compose version > /dev/null 2>&1 || { echo "ERROR: docker compose plugin not found."; exit 1; }'
        }
      }
    }

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --oneline'
      }
    }

    stage('Build Images') {
      parallel {
        stage('Build Server') {
          steps {
            sh 'docker build -f Dockerfile.server -t ${REGISTRY_URL}/evoke-sync-server:${IMAGE_TAG} -t ${REGISTRY_URL}/evoke-sync-server:latest .'
          }
        }
        stage('Build Client') {
          steps {
            sh 'docker build -f Dockerfile.client -t ${REGISTRY_URL}/evoke-sync-client:${IMAGE_TAG} -t ${REGISTRY_URL}/evoke-sync-client:latest .'
          }
        }
      }
    }

    stage('Push to Registry') {
      steps {
        sh 'docker push ${REGISTRY_URL}/evoke-sync-server:${IMAGE_TAG}'
        sh 'docker push ${REGISTRY_URL}/evoke-sync-server:latest'
        sh 'docker push ${REGISTRY_URL}/evoke-sync-client:${IMAGE_TAG}'
        sh 'docker push ${REGISTRY_URL}/evoke-sync-client:latest'
      }
    }

    stage('Deploy') {
      steps {
        script {
          sh 'cp ${COMPOSE_FILE} ${DEPLOY_DIR}/${COMPOSE_FILE}'
          sh '''
            cd ${DEPLOY_DIR}
            docker compose -f ${COMPOSE_FILE} pull server client
            docker compose -f ${COMPOSE_FILE} up -d --no-deps server client
          '''
        }
      }
    }

    stage('Health Check') {
      steps {
        script {
          retry(12) {
            sleep(time: 5, unit: 'SECONDS')
            sh 'curl -sf http://192.168.4.99:5015/health > /dev/null || { echo "Server not ready yet..."; exit 1; }'
          }
          echo 'Deployment successful — server is healthy.'
        }
      }
    }
  }

  post {
    success {
      echo "Build ${IMAGE_TAG} deployed successfully."
    }
    failure {
      script {
        echo "Build ${IMAGE_TAG} failed. Rolling back to previous images..."
        sh '''
          cd ${DEPLOY_DIR}
          IMAGE_TAG=latest docker compose -f ${COMPOSE_FILE} up -d --no-deps server client || true
        '''
      }
    }
    always {
      script {
        sh 'docker image prune -f || true'
        sh '''
          for image in ${REGISTRY_URL}/evoke-sync-server ${REGISTRY_URL}/evoke-sync-client; do
            docker images "$image" --format '{{.Tag}}' \
              | grep -E '^[0-9]+$' \
              | sort -n \
              | head -n -3 \
              | xargs -r -I{} docker rmi "$image:{}" || true
          done
        '''
      }
    }
  }
}
