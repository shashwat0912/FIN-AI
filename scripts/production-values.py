#!/usr/bin/env python3
"""Generate non-secret Helm launch overrides from Terraform output JSON and env."""
import json
import os
import re
import sys


def launch_values(outputs, env):
    def output(name):
        return outputs[name]["value"]

    def required(name, pattern):
        value = env.get(name, "")
        if not re.fullmatch(pattern, value):
            raise ValueError(f"Missing or invalid {name}")
        return value

    host = required("PRODUCTION_HOSTNAME", r"(?=.{1,253}$)[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}")
    cert = required("ACM_CERTIFICATE_ARN", r"arn:aws:acm:[a-z0-9-]+:[0-9]{12}:certificate/[a-f0-9-]+")
    images = output("ecr_repository_urls")
    config = {
        "CORS_ORIGIN": f"https://{host}",
        "REDIS_HOST": output("valkey_primary_endpoint_address"),
        "REDIS_USERNAME": output("valkey_application_user_id"),
        "REDIS_IAM_CACHE_NAME": output("valkey_replication_group_id"),
        "AWS_REGION": output("aws_region"),
    }
    if any(not value or "REQUIRED" in value for value in config.values()):
        raise ValueError("Terraform outputs are incomplete")
    if config["AWS_REGION"] != "ap-south-1":
        raise ValueError("The backend image currently bundles the ap-south-1 RDS CA; extend the verified CA bundle before using another region")
    if cert.split(":")[3] != config["AWS_REGION"]:
        raise ValueError("ACM certificate must be in the cluster region")
    return {
        "backend": {
            "config": config,
            "serviceAccount": {"annotations": {"eks.amazonaws.com/role-arn": output("backend_irsa_role_arn")}},
            "image": {"repository": images["backend"], "digest": required("BACKEND_IMAGE_DIGEST", r"sha256:[a-f0-9]{64}")},
        },
        "frontend": {"image": {"repository": images["frontend"], "digest": required("FRONTEND_IMAGE_DIGEST", r"sha256:[a-f0-9]{64}")}},
        "ingress": {"enabled": True, "hosts": [host], "annotations": {"alb.ingress.kubernetes.io/certificate-arn": cert}},
    }


if __name__ == "__main__":
    try:
        with open(sys.argv[1]) as source:
            print(json.dumps(launch_values(json.load(source), os.environ), indent=2))
    except (IndexError, KeyError, ValueError) as error:
        sys.exit(f"Launch values rejected: {error}")
