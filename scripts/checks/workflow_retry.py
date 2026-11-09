"""Require an actual connected error output or an explicitly enabled bounded retry."""

def has_retry_or_error_branch(workflow):
    nodes = workflow.get('nodes', [])
    names = {node.get('name') for node in nodes}
    connections = workflow.get('connections', {})
    for node in nodes:
        if node.get('type') != 'n8n-nodes-base.httpRequest':
            continue
        retries = node.get('maxTries')
        if node.get('retryOnFail') is True and type(retries) is int and 2 <= retries <= 3:
            return True
        outputs = connections.get(node.get('name'), {}).get('main', [])
        if node.get('onError') == 'continueErrorOutput' and len(outputs) > 1:
            if any(edge.get('node') in names for edge in outputs[1]):
                return True
    return False
