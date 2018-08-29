#!/bin/bash -e

export ENV="$1"

[ ! -z "$ENV" ]

. "$ENV"

if [ "$TRAVIS_BRANCH" = "$BRANCH" ] && [ "$TRAVIS_PULL_REQUEST" = "false" ]; then
  ./scripts/deploy.sh $(git rev-parse HEAD);
else
  echo "Skipping deployment for $ENV:"
  echo "  - current branch is $TRAVIS_BRANCH (pull request: $TRAVIS_PULL_REQUEST)"
  echo "  - destination allows deployments only from branch '$BRANCH'"
  false
fi
