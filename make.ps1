$extensionPrefix="RobBos.GHAzDoWidget-DEV-"
# delete all files with the name RobBos.GHAzDoWidget-DEV*.vsix
Get-ChildItem -Path .\ -Filter $extensionPrefix*.vsix | Remove-Item -Force

# build the task
# todo: up the version number
Set-Location .\dependencyReviewTask
npm run build

# go back to top level
Set-Location ..

# package the whole extension
tfx extension create --manifest-globs vss-extension-dev.json --rev-version

# get the new version number from the json file
$json = Get-Content .\vss-extension-dev.json | ConvertFrom-Json
$visx = "$extensionPrefix$($json.version).vsix"

# check if $env:AZURE_DEVOPS_PAT has a value
if ($null -eq $env:AZURE_DEVOPS_PAT) {
    Write-Host "Environment variable AZURE_DEVOPS_PAT is not set. Please set it to a valid PAT"
    exit
}

Write-Host "Publishing [$visx]"
tfx extension publish --vsix $visx  --service-url https://marketplace.visualstudio.com --token "$($env:AZURE_DEVOPS_PAT)"

# display the current date/time
Get-Date
