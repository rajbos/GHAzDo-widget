# load the given arguments
param(
    [ValidateSet("provision", "build", "publish", "")]
    [string]$command = "provision",
    [int] $provisionCount = 100
)

# global settings
$organization = "xpirit"
$baseurl = "https://dev.azure.com/$organization"
$projectName = "GHAzDo%20Internal%20Bootcamp"
$apiVersion = "api-version=7.1"
$apiVersionAdvSec = "api-version=7.1-preview.1"
$sourceRepo = "https://github.com/rajbos/WebGoat.NETCore.git"
$sourceRepo2 = "https://xpirit@dev.azure.com/xpirit/TailWindTraders/_git/TailwindTraders-Website"

$tempFolder = "$($env:TEMP)/ghazdo-WebGoatSource"
$tempFolder2 = "$($env:TEMP)/ghazdo-TailwindSource"

function Get-Project {
    param (
        [string] $teamProject,
        [string] $AccessToken
    )

    $url = "$baseurl/_apis/projects/$($teamProject)?$($apiVersion)"
    $projectresponse = Invoke-RestMethod -Uri $url -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Get

    return $projectresponse
}

function Update-GHAzDoSettings {
    param (
        [string] $teamProject,
        [string] $repoName,
        [string] $repoId,
        [string] $projectId,
        [string] $AccessToken
    )

    $url = "https://advsec.dev.azure.com/$organization/$projectId/_apis/Management/repositories/$repoId/enablement?$apiVersionAdvSec"
    $body = @{
        advSecEnabled = "true"
        blockPushes = "false"
    }
    $json = (ConvertTo-Json $body)
    try {
        Invoke-RestMethod -Uri $url -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Patch -Body $json
        Write-Host "Updated GHAzDo settings for repo [$repoName]"
    }
    catch {
        Write-Host "Error updating GHAzDo settings for repo [$repoName]"
        Write-Host $_.Exception.Message
        return
    }
}

function New-Repository {
    param
    (
        [object] $project,
        [string] $repoName,
        [string] $AccessToken,
        [string] $tempFolder
    )

    $repoURL = "$baseurl/$($project.Name)/_apis/git/repositories?$apiVersion"

    $requestBody = @{
        name        = "$repoName"
        description = "Generated example repo for GHAzDo"

        project = @{
            id = "$($project.id)"
        }
    }
    $json = (ConvertTo-Json $requestBody)

    $repo = Invoke-RestMethod -Uri $repoURL -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Post -Body $json

    # get the git url for this new repo
    $gitUrl = $repo.remoteUrl
    PushLocalRepoToRemote -gitUrl $gitUrl -repoName $repoName -tempFolder $tempFolder

    # enable GHAzDo on this repo
    Update-GHAzDoSettings -teamProject $project.name -repoName $repoName -AccessToken $AccessToken -repoId $repo.id -projectId $project.id

    New-BuildDefinition -teamProject $project.name -repoName $repoName -AccessToken $AccessToken -repoId $repo.id

    return $repo
}

function Get-Repository
{
    param
    (
     [string] $teamProject,
     [string] $repoName,
     [string] $AccessToken
    )

    $repoURL = "$baseurl/$teamProject/_apis/git/repositories?api-version=1.0"
    $response = Invoke-RestMethod -Uri $repoURL -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Get

    foreach($t in $($response.value))
    {
        if ($t.name -eq $repoName)
        {
            return $t;
        }
    }
    return $null;
}

function GetSourceRepo {
    param (
        [string] $sourceRepo,
        [string] $tempFolder
    )
    # create a temp folder locally if it does not exists
    if (!(Test-Path $tempFolder)) {
        New-Item -ItemType Directory -Path $tempFolder

        # git clone the repo from $sourceRepo
        git clone $sourceRepo $tempFolder

        $subfolder = ".azure-devops"
        if (!(Test-Path "$tempFolder/$($subfolder)")) {
            Write-Host "Creating [$tempFolder/$($subfolder)]"
            New-Item -ItemType Directory -Path "$tempFolder/$($subfolder)" | Out-Null
        }

        # overwrite the file in the .azure-devops/build.yml with the content from /development/WebGoat-GHAzDo-starter-pipeline.yml file
        Write-Host "Copying build.yml from [$PSScriptRoot/development/WebGoat-GHAzDo-starter-pipeline.yml] to [$tempFolder/$subfolder/build.yml]"
        Copy-Item -Path $PSScriptRoot/development/WebGoat-GHAzDo-starter-pipeline.yml -Destination $tempFolder/$subfolder/build.yml -Force
        Set-Location $tempFolder

        git add $subfolder
        git add $subfolder/build.yml
        git commit -m "Updated build.yml"

        # go back to the original folder
        Set-Location $PSScriptRoot
    }
}

function PushLocalRepoToRemote {
    param (
        [string] $repoName,
        [string] $gitUrl,
        [string] $tempFolder
    )

    Write-Host "Pushing repo contents to remote"
    # go to the temp folder
    Set-Location $tempFolder | Out-Null

    if ($env:CI) {
        Write-Host "Running in CI mode!"
        # configure the PAT we have inside the remote url
        #sample url: https://xpirit@dev.azure.com/xpirit/GHAzDo%20Internal%20Bootcamp/_git/ghazdo-4664
        $gitUrl = $gitUrl -replace "https://xpirit@", "https://x:$($env:AZURE_DEVOPS_CREATE_PAT)@"
        Write-Host "New git url: [$gitUrl]"
    }

    Write-Host "Setting the remote"
    # add the remote
    git remote add $repoName $gitUrl #*> $null

    Write-Host "Pushing to the remote"
    # push to the new remote
    git push $repoName #*> $null
    Write-Host "After pushing to the remote"

    # go back to the original folder
    Set-Location $PSScriptRoot
}

function New-BuildDefinition {
    param (
        [string] $teamProject,
        [string] $repoName,
        [string] $repoId,
        [string] $AccessToken
    )

    $pipeLineName = "$repoName Build"

    # check if the build definition already exists
    $url = "$baseurl/$teamProject/_apis/pipelines?$apiVersion"
    $response = Invoke-RestMethod -Uri $url -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Get
    $exisingBuild = $response.value | Where-Object { $_.name -eq $pipeLineName }
    if ($exisingBuild) {
        # stop running
        Write-Host "Build definition [$pipeLineName] already exists"
        return
    }

    # now create the build definition
    $body = @{
        configuration = @{
            type = "yaml"
            path = "/.azure-devops/build.yml"
            repository = @{
                type = "azureReposGit"
                name = "$repoName"
                id = "$repoId"
            }
        }
        folder = "/.azure-devops"
        name = $pipeLineName
    }

    try
    {
        $json = (ConvertTo-Json $body)
        $response = Invoke-RestMethod -Uri $url -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Post -Body $json

        Write-Host "Created build definition [$($response.name)]"
        $pipelineId = $response.id

        # trigger the pipeline to run
        $url = "$baseurl/$teamProject/_apis/pipelines/$pipelineId/runs?$apiVersion"
        $triggerBody = @{
            resources = @{
                repositories= @{
                    self = @{
                        refName = "refs/heads/main"
                    }
                }
            }
        }
        $json = (ConvertTo-Json $triggerBody -Depth 10)
        $response = Invoke-RestMethod -Uri $url -Headers @{Authorization = $AccessToken} -ContentType "application/json" -Method Post -Body $json

        Write-Host "Triggered build definition [$($response.name)]"
    }
    catch {
        if ($_.Exception.Message -like "*already exists*") {
            Write-Debug "Build definition [$($response.name)] already exists"
        }
        else {
            Write-Host "Error creating build definition [$($response.name)]" # repo was still empty
            Write-Host $_.Exception.Message
        }
    }
}

function New-VSTSAuthenticationToken {
    [CmdletBinding()]
    [OutputType([object])]

    param (
        [string] $PersonalAccessToken
    )

    $accesstoken = "";
    Write-Debug $($PersonalAccessToken)
    $userpass = ":$($PersonalAccessToken)"
    $encodedCreds = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes($userpass))
    $accesstoken = "Basic $encodedCreds"

    return $accesstoken;
}

function Build {
    param (
        [ValidateSet("dev", "prod")]
        [string] $buildtype
    )
    Write-Host "Building the [$buildtype] version"

    # check if $env:AZURE_DEVOPS_PAT has a value
    if ($null -eq $env:AZURE_DEVOPS_PAT) {
        Write-Host "Environment variable AZURE_DEVOPS_PAT is not set. Please set it to a valid PAT"
        exit
    }

    # default values for dev
    $vsix = "vss-extension-dev.json"
    $extensionPrefix="RobBos.GHAzDoWidget-DEV-"
    $extensionId = "GHAzDoWidget-DEV"

    if ($buildtype -eq "prod") {
        # values for prod
        $vsix = "vss-extension.json"
        $extensionPrefix="RobBos.GHAzDoWidget-"
        $extensionId = "GHAzDoWidget"
    }

    # delete all files with the name prefix*.vsix
    Get-ChildItem -Path .\ -Filter $extensionPrefix*.vsix | Remove-Item -Force

    # get the last updated version for this extension from the server to make sure we are rolling forward
    try {
        $output = $(tfx extension show --token $env:AZURE_DEVOPS_PAT --vsix $vsix --publisher "RobBos" --extension-id $extensionId --output json | ConvertFrom-Json)
        $lastVersion = ($output.versions | Sort-Object -Property lastUpdated -Descending)[0]
        Write-Host "Last version: [$($lastVersion.version)] from server"
        # overwrite the version in the json file
        $json = Get-Content .\$vsix | ConvertFrom-Json -Depth 10
        $json.version = $lastVersion.version
        # write the json file back
        $json | ConvertTo-Json -Depth 10 | Set-Content .\$vsix
    }
    catch {
        Write-Host "Error loading the version from Azure DevOps Marketplace, check the [$$env:AZURE_DEVOPS_PAT] setting if it has the right scopes"
        return
    }

    # build the task
    # todo: up the version number
    Set-Location .\dependencyReviewTask
    npm run build

    # go back to top level
    Set-Location ..

    # package the whole extension
    Write-Host "Packaging the extension"
    tfx extension create --manifest-globs $vsix --rev-version

    # get the new version number from the json file
    $json = Get-Content .\$vsix | ConvertFrom-Json
    $visx = "$extensionPrefix$($json.version).vsix"

    Write-Host "Publishing [$visx]"
    tfx extension publish --vsix $visx --service-url https://marketplace.visualstudio.com --token "$($env:AZURE_DEVOPS_PAT)"
}

if ("build" -eq $command) {
    Build -buildtype "dev"
    exit
}

if ("publish" -eq $command) {
    Build -buildtype "prod"
    exit
}

if ("provision" -eq $command) {
    Write-Host "Provisioning the projects with repos"

    # check if $env:AZURE_DEVOPS_PAT has a value
    if ($null -eq $env:AZURE_DEVOPS_CREATE_PAT) {
        Write-Host "Environment variable AZURE_DEVOPS_CREATE_PAT is not set. Please set it to a valid PAT"
        exit
    }

    # choose what the source repo will be
    GetSourceRepo -sourceRepo $sourceRepo -tempFolder $tempFolder # the AutoBuild for tailwindtraders fails :-()
    #GetSourceRepo -sourceRepo $sourceRepo2 -tempFolder $tempFolder2

    $AccessToken = New-VSTSAuthenticationToken -PersonalAccessToken $env:AZURE_DEVOPS_CREATE_PAT
    $project = Get-Project -teamProject $projectName -AccessToken $AccessToken
    $createdCount = 0
    $maxCount = $provisionCount
    while ($createdCount -lt $maxCount) {
        # create a random list of generated repo names starting with "ghazdo"
        $repoName = "ghazdo-$((Get-Random -Minimum 1000 -Maximum 9999).ToString())"

        # check if the repo already exists
        $repo = Get-Repository -teamProject $projectName -repoName $repoName -AccessToken $AccessToken

        if ($repo) {
            Write-Host "Repo [$repoName] already exists with repoUrl [$($repo.remoteUrl)]"

             # enable GHAzDo on this repo
            Update-GHAzDoSettings -teamProject $projectName -repoName $repoName -AccessToken $AccessToken -repoId $repo.id -projectId $project.id
            New-BuildDefinition -teamProject $projectName -repoName $repoName -AccessToken $AccessToken -repoId $repo.id
            continue
        }

        # create a new repo
        $repo = New-Repository -AccessToken $AccessToken -repoName $repoName -project $project -tempFolder $tempFolder
        if ($null -ne $repo) {
            $createdCount++
            Write-Host "Created repo $createdCount/$maxCount [$($repo.name)]"
        }
    }

    Set-Location $PSScriptRoot

    exit
}

Write-Host "Unknown command [$command]"