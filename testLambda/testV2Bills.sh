#!/usr/bin/env bash

env SLS_DEBUG=* serverless invoke local --function v2Bills --path $1
