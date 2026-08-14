import sys

with open('ios/Finanzas.xcodeproj/project.pbxproj', 'r') as f:
    content = f.read()

# Replace the specific offending string
old_str = "\\\"`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`\\\""
new_str = "\"`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`\""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('ios/Finanzas.xcodeproj/project.pbxproj', 'w') as f:
        f.write(content)
    print("Fixed!")
else:
    print("Old string not found.")
