import sys

with open('ios/Finanzas.xcodeproj/project.pbxproj', 'r') as f:
    content = f.read()

# I want to replace the current corrupted line with the exact string I want.
# The corrupted string has `\\\"` in it.
# Let's just locate the line by `shellScript = "if [[ -f \\"$PODS_ROOT` and replace the whole block.
import re
pattern = r'(shellScript = "if \[\[ -f \\"\$PODS_ROOT/\.\./\.xcode\.env\\".*?)(`.*?`.*?\n\n";)'

def repl(m):
    prefix = m.group(1)
    # The new string should be EXACTLY: \"`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`\"\n\n";
    new_suffix = r"\"`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`\"\n\n" + '";'
    return prefix + new_suffix

new_content = re.sub(pattern, repl, content, flags=re.DOTALL)
if content != new_content:
    with open('ios/Finanzas.xcodeproj/project.pbxproj', 'w') as f:
        f.write(new_content)
    print("Fixed via regex!")
else:
    print("Pattern not found!")
