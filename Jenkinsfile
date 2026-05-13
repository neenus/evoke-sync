pipeline {
  agent any

  environment {
    REGISTRY_URL    = credentials('REGISTRY_URL')
    IMAGE_TAG       = "${env.BUILD_NUMBER}"
    SERVER_IMAGE    = "${REGISTRY_URL}/evoke-sync-server"
    CLIENT_IMAGE    = "${REGISTRY_URL}/evoke-sync-client"
    DEPLOY_DIR      = '/volume1/evoke-sync'
    COMPOSE_FILE    = 'docker-compose.prod.yml'
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
          // Verify Docker is accessible from Jenkins
          sh 'docker info > /dev/null 2>&1 || { echo "ERROR: Docker not accessible. Mount /var/run/docker.sock into Jenkins container."; exit 1; }'

          // Verify the registry is reachable
          sh "curl -sf http://${REGISTRY_URL}/v2/ > /dev/null || { echo 'ERROR: Registry at ${REGISTRY_URL} is not reachable. Check insecure-registries config.'; exit 1; }"

          // Verify .env exists in deploy dir
          sh "test -f ${DEPLOY_DIR}/.env || { echo 'ERROR: ${DEPLOY_DIR}/.env not found. Create it on the NAS before running the pipeline.'; exit 1; }"

          // Verify docker compose is available
          sh "docker compose version > /dev/null 2>&1 || { echo 'ERROR: docker compose plugin not found.'; exit 1; }"
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
            sh "docker build -f Dockerfile.server -t ${SERVER_IMAGE}:${IMAGE_TAG} -t ${SERVER_IMAGE}:latest ."
          }
        }
        stage('Build Client') {
          steps {
            sh "docker build -f Dockerfile.client -t ${CLIENT_IMAGE}:${IMAGE_TAG} -t ${CLIENT_IMAGE}:latest ."
          }
        }
      }
    }

    stage('Push to Registry') {
      steps {
        sh "docker push ${SERVER_IMAGE}:${IMAGE_TAG}"
        sh "docker push ${SERVER_IMAGE}:latest"
        sh "docker push ${CLIENT_IMAGE}:${IMAGE_TAG}"
        sh "docker push ${CLIENT_IMAGE}:latest"
      }
    }

    stage('Deploy') {
      steps {
        script {
          // Copy the compose file to the deploy directory
          sh "cp ${COMPOSE_FILE} ${DEPLOY_DIR}/${COMPOSE_FILE}"

          // Pull new images and restart only app containers (mongo is left running to preserve data)
          sh """
            cd ${DEPLOY_DIR}
            REGISTRY_URL=${REGISTRY_URL} IMAGE_TAG=${IMAGE_TAG} docker compose -f ${COMPOSE_FILE} pull server client
            REGISTRY_URL=${REGISTRY_URL} IMAGE_TAG=${IMAGE_TAG} docker compose -f ${COMPOSE_FILE} up -d --no-deps server client
          """
        }
      }
    }

    stage('Health Check') {
      steps {
        script {
          // Wait up to 60s for the server to respond
          retry(12) {
            sleep(time: 5, unit: 'SECONDS')
            sh 'curl -sf http://localhost:5015/api/health > /dev/null || { echo "Server not ready yet..."; exit 1; }'
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
        sh """
          cd ${DEPLOY_DIR}
          REGISTRY_URL=${REGISTRY_URL} IMAGE_TAG=latest docker compose -f ${COMPOSE_FILE} up -d --no-deps server client || true
        """
      }
    }
    always {
      script {
        // Remove dangling images to prevent disk fill-up
        sh 'docker image prune -f || true'
        // Keep only the last 3 tagged builds in the registry (best-effort)
        sh """
          for image in ${SERVER_IMAGE} ${CLIENT_IMAGE}; do
            docker images "\$image" --format '{{.Tag}}' | grep -E '^[0-9]+$' | sort -n | head -n -3 | xargs -r -I{} docker rmi "\$image:{}" || true
          done
        """
      }
    }
  }
}
