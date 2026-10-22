"""Pure geometry and state parsing shared by emulator checks and offline regressions."""
import re


def visible_bounds(node):
    box = tuple(map(int, re.findall(r'-?\d+', node.get('bounds', ''))))
    return (max(0, box[0]), max(0, box[1]), box[2], box[3]) if len(box) == 4 and box[2] > max(0, box[0]) and box[3] > max(0, box[1]) else None


def find_node(root, value):
    candidates = [node for node in root.iter('node') if visible_bounds(node)]
    label = lambda node: node.get('content-desc') or node.get('text', '')
    exact = next((node for node in candidates if label(node) == value), None)
    return exact if exact is not None else next((node for node in candidates if re.match(re.escape(value) + r'(?:[ ,\n]|$)', label(node))), None)


def find_folder_row(root, path):
    # Match the actionable row, not a heading or a clipped child text node.
    for node in root.iter('node'):
        label = node.get('content-desc') or node.get('text', '')
        if node.get('clickable') == 'true' and visible_bounds(node) and (
            label == 'Open folder ' + path or label.startswith(path + ', ')
        ):
            return node
    return None


def find_view(root, test_id):
    return next((node for node in root.iter('node') if
                 node.get('resource-id', '').split(':id/')[-1] == test_id
                 and visible_bounds(node)), None)


def scroll_gesture(root, reverse=False):
    boxes = [visible_bounds(node) for node in root.iter('node') if node.get('scrollable') == 'true']
    boxes = [box for box in boxes if box and box[3] - box[1] > 100]
    if not boxes:
        raise AssertionError('No visible scrollable content')
    left, top, right, bottom = max(boxes, key=lambda box: (box[2] - box[0]) * (box[3] - box[1]))
    x = round(left + (right - left) * .06)
    high = round(top + (bottom - top) * .25)
    low = round(top + (bottom - top) * .8)
    return (x, high, x, low) if reverse else (x, low, x, high)


def system_night(raw):
    match = re.search(r'\bmCurUiMode=(0x[0-9a-fA-F]+)', raw)
    if not match:
        raise AssertionError('Android did not report the applied UI mode')
    return int(match[1], 16) & 0x30 == 0x20


def fixture_indexed(raw):
    return any(re.search(r'\btitle=Theme Song(?:,|$)', line) and re.search(r'\bduration=[1-9]\d*', line) for line in raw.splitlines())
