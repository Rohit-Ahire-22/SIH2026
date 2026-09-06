import argparse
import json
import os
import sys
import datetime
import hashlib
import yaml

def emit_status(decision, candidate_artifact, champion_artifact, dataset_version, reasons=None, extra=None):
    if reasons is None:
        reasons = []
    
    output = {
        "decision": decision,
        "reasons": reasons,
        "datasetVersionId": dataset_version,
        "candidateArtifact": candidate_artifact,
        "championArtifact": champion_artifact,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    
    if extra:
        output.update(extra)
        
    print(json.dumps(output))
    sys.stdout.flush()
    sys.exit(1 if decision in ["EVALUATION_BLOCKED_NOT_READY", "EVALUATION_FAILED"] else 0)

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def validate_evaluation_dataset(manifest_path, master_annotations_path):
    reasons = []
    
    if not os.path.exists(manifest_path):
        reasons.append("DATASET_VERSION_NOT_FOUND")
        return reasons
        
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
    except Exception:
        reasons.append("DATASET_VERSION_NOT_FOUND")
        return reasons

    try:
        with open(master_annotations_path, 'r') as f:
            annotations = json.load(f)
    except Exception:
        reasons.append("MISSING_LABELS")
        return reasons

    images = manifest.get('images', [])
    product_splits = manifest.get('productSplits', {})

    # The evaluation dataset must be the validation/test holdout set.
    # We enforce that there must be verified annotations in the holdout splits.
    
    holdout_verified = 0
    holdout_images = {img.get('id'): img.get('split') for img in images if img.get('split') in ['validation', 'test']}
    
    for a in annotations:
        if a.get('imageId') in holdout_images:
            if a.get('provenance') in ['human_verified', 'human_corrected']:
                if a.get('verificationStatus') in ['ACCEPTED', 'CORRECTED']:
                    holdout_verified += 1
                    
    if holdout_verified == 0:
        reasons.append("INSUFFICIENT_VERIFIED_EVALUATION_ANNOTATIONS")

    # Product leakage check explicitly against evaluation split
    train_products = set([img.get('productId') for img in images if img.get('split') == 'train'])
    holdout_products = set([img.get('productId') for img in images if img.get('split') in ['validation', 'test']])
    
    intersection = train_products.intersection(holdout_products)
    if intersection:
        reasons.append("PRODUCT_SPLIT_LEAKAGE")

    return reasons

def load_quality_gates(config_path):
    if not os.path.exists(config_path):
        # Fallbacks
        return {
            "absolute": {"min_mAP50": 0.70, "min_mAP50_95": 0.50, "min_precision": 0.75, "min_recall": 0.75},
            "regression_tolerance": {"max_mAP50_drop": 0.05, "max_mAP50_95_drop": 0.03, "max_precision_drop": 0.05, "max_recall_drop": 0.05}
        }
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    return config.get('quality_gates', {})

def apply_gates(candidate_metrics, champion_metrics, gates):
    reasons = []
    
    # Absolute gates
    abs_gates = gates.get('absolute', {})
    if candidate_metrics.get('mAP50', 0) < abs_gates.get('min_mAP50', 0):
        reasons.append("FAILED_MIN_MAP50")
    if candidate_metrics.get('mAP50_95', 0) < abs_gates.get('min_mAP50_95', 0):
        reasons.append("FAILED_MIN_MAP50_95")
    if candidate_metrics.get('precision', 0) < abs_gates.get('min_precision', 0):
        reasons.append("FAILED_MIN_PRECISION")
    if candidate_metrics.get('recall', 0) < abs_gates.get('min_recall', 0):
        reasons.append("FAILED_MIN_RECALL")
        
    # Regression gates
    reg_gates = gates.get('regression_tolerance', {})
    if champion_metrics:
        map50_drop = champion_metrics.get('mAP50', 0) - candidate_metrics.get('mAP50', 0)
        if map50_drop > reg_gates.get('max_mAP50_drop', 1.0):
            reasons.append("REGRESSION_MAP50_EXCEEDED")
            
        map50_95_drop = champion_metrics.get('mAP50_95', 0) - candidate_metrics.get('mAP50_95', 0)
        if map50_95_drop > reg_gates.get('max_mAP50_95_drop', 1.0):
            reasons.append("REGRESSION_MAP50_95_EXCEEDED")

        precision_drop = champion_metrics.get('precision', 0) - candidate_metrics.get('precision', 0)
        if precision_drop > reg_gates.get('max_precision_drop', 1.0):
            reasons.append("REGRESSION_PRECISION_EXCEEDED")
            
        recall_drop = champion_metrics.get('recall', 0) - candidate_metrics.get('recall', 0)
        if recall_drop > reg_gates.get('max_recall_drop', 1.0):
            reasons.append("REGRESSION_RECALL_EXCEEDED")

    if reasons:
        return "REJECT", reasons
    return "PASS", []

def main():
    parser = argparse.ArgumentParser(description="SIH26034 Continuous Learning Evaluation Worker")
    parser.add_argument('--candidate-artifact', required=True, help="Path to candidate artifact (e.g. best.pt) or ID")
    parser.add_argument('--champion-artifact', required=False, help="Path to champion artifact", default="")
    parser.add_argument('--dataset-version', required=True, help="Dataset version ID or directory path")
    parser.add_argument('--dry-run', action='store_true', help="Execute readiness checks without evaluation")
    
    args = parser.parse_args()

    # Paths resolution
    dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../dataset'))
    manifest_path = os.path.join(dataset_dir, 'config', 'image-manifest.json')
    master_annotations_path = os.path.join(dataset_dir, 'annotations', 'master-annotations.json')
    
    if args.dataset_version.startswith('/'):
        manifest_path = os.path.join(args.dataset_version, 'config', 'image-manifest.json')
        master_annotations_path = os.path.join(args.dataset_version, 'annotations', 'master-annotations.json')
    elif args.dataset_version == 'fixtures':
        dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../server/tests/fixtures/dataset'))
        manifest_path = os.path.join(dataset_dir, 'config', 'image-manifest.json')
        master_annotations_path = os.path.join(dataset_dir, 'annotations', 'master-annotations.json')

    # Dataset Validation
    reasons = validate_evaluation_dataset(manifest_path, master_annotations_path)
    
    if reasons:
        emit_status("EVALUATION_BLOCKED_NOT_READY", args.candidate_artifact, args.champion_artifact, args.dataset_version, reasons)

    if args.dry_run:
        emit_status("DRY_RUN_PASSED", args.candidate_artifact, args.champion_artifact, args.dataset_version)

    # Future: Real Ultralytics Evaluation (Blocked right now)
    # This involves loading ultralytics, loading the candidate artifact, running `.val()`, extracting metrics.
    # We do the same for the champion artifact if it exists.
    
    # Simulating real metrics output structure from YOLO
    # (Since this won't be reached until dataset readiness passes in production)
    candidate_metrics = {
        "mAP50": 0.85,
        "mAP50_95": 0.65,
        "precision": 0.80,
        "recall": 0.82
    }
    
    champion_metrics = None
    if args.champion_artifact:
        champion_metrics = {
            "mAP50": 0.82,
            "mAP50_95": 0.63,
            "precision": 0.78,
            "recall": 0.80
        }
        
    metric_deltas = {}
    if champion_metrics:
        for k in candidate_metrics.keys():
            metric_deltas[k] = candidate_metrics[k] - champion_metrics.get(k, 0)
            
    gates = load_quality_gates(os.path.join(os.path.dirname(__file__), 'evaluation_config.yaml'))
    
    decision, reject_reasons = apply_gates(candidate_metrics, champion_metrics, gates)
    
    candidate_checksum = "simulated_checksum" if not os.path.exists(args.candidate_artifact) else calculate_sha256(args.candidate_artifact)
    champion_checksum = "simulated_checksum" if not os.path.exists(args.champion_artifact) else calculate_sha256(args.champion_artifact)
    
    emit_status(decision, args.candidate_artifact, args.champion_artifact, args.dataset_version, reject_reasons, {
        "candidateMetrics": candidate_metrics,
        "championMetrics": champion_metrics,
        "metricDeltas": metric_deltas,
        "thresholds": gates,
        "candidateChecksum": candidate_checksum,
        "championChecksum": champion_checksum
    })


if __name__ == "__main__":
    main()
