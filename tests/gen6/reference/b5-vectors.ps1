# Run in 32-bit Windows PowerShell with 3DS RNG Tool v1.0.6.
param([Parameter(Mandatory=$true)][string]$ReferenceExe)
$ErrorActionPreference='Stop'
$assembly=[Reflection.Assembly]::LoadFrom((Resolve-Path -LiteralPath $ReferenceExe).Path)
$pool=$assembly.GetType('Pk3DSRNGTool.Core.RNGPool')
$generate=$pool.GetMethod('Generate6')
$addNext=$pool.GetMethod('AddNext')

function Start-Scenario($generator,[int]$start,[int]$delay) {
    $null=$pool.GetMethod('Clear').Invoke($null,$null)
    $script:rng=[Pk3DSRNGTool.RNG.MersenneTwister]::new([uint32]0x35b19af2)
    for($i=0;$i -lt $start;$i++) { $rng.Next() }
    $null=$pool.GetMethod('CreateBuffer').Invoke($null,@($rng,5000,$true))
    $pool.GetField('igenerator').SetValue($null,$generator)
    $pool.GetField('Considerdelay').SetValue($null,($delay -ne 0))
    $pool.GetField('DelayTime').SetValue($null,$delay)
}

function Format-Pokemon($row) {
    @($row.PID.ToString('X8'),$row.EC.ToString('X8'),($row.IVs -join ','),$row.Nature,$row.Ability,$row.Gender,[int]$row.Shiny) -join ' '
}

$state=[uint32[]]@(0xddeeff00L,0x99aabbccL,0x55667788L,0x11223344L)
$stationary=@(foreach($game in 'X','OR') {
    foreach($withDelay in $false,$true) {
        $oras=$game -eq 'OR'
        $delay=if(!$withDelay){0}elseif($oras){158}else{2}
        $clock=[Pk3DSRNGTool.TinyTimeline]::new($state)
        $clock.Startingframe=500
        $clock.Maxframe=764
        $clock.Method=[byte]$(if($oras){1}else{0})
        $clock.P1=2
        $clock.CryFrame=if($withDelay){31}else{-1}
        $clock.Delay=if($withDelay){78}else{0}
        $clock.IsORAS=$oras
        $clock.Add(500,0)
        $clock.Add(500,1)
        $clock.Generate($false,$true)
        $spanType=$assembly.GetType('Pk3DSRNGTool.Frame_Tiny')
        $spanMin=$spanType.GetField('framemin')
        $spanMax=$spanType.GetField('framemax')
        $spanSync=$spanType.GetProperty('Sync')
        $gen=[Pk3DSRNGTool.Stationary6]::new()
        $gen.IV3=$true
        $gen.IVs=[int[]]@(-1,-1,-1,-1,-1,-1)
        $gen.Ability=[byte]$(if($oras){0}else{1})
        $gen.IsShinyLocked=!$oras
        $gen.Synchro_Stat=[byte]3
        $gen.SetValue()
        Start-Scenario $gen 502 $delay
        $rows=@(foreach($span in $clock.results) {
            for($frame=$spanMin.GetValue($span)+2;$frame -le [Math]::Min($spanMax.GetValue($span),764);$frame+=2) {
                $synced=$spanSync.GetValue($span,$null) -eq 'O'
                $pool.GetField('TinySynced').SetValue($null,$synced)
                $row=$generate.Invoke($null,$null)
                "$frame $([int]$synced) $(Format-Pokemon $row)"
                $null=$addNext.Invoke($null,@($rng,$true))
                $null=$addNext.Invoke($null,@($rng,$true))
            }
        })
        @{game=$game;delay=$delay;rows=$rows}
    }
})

$event=@(foreach($oras in $false,$true) {
    foreach($type in 0..3) {
        $gen=[Pk3DSRNGTool.Event6]::new()
        $gen.IsORAS=$oras
        $gen.PIDType=[byte]$type
        $gen.PID=[uint32]0x12345678
        $gen.EC=[uint32]$(if($type -eq 3){0x10203040}else{0})
        $gen.TID=[uint16]12345
        $gen.SID=[uint16]54321
        $gen.TSV=[uint16](($gen.TID -bxor $gen.SID) -shr 4)
        $gen.OtherInfo=$true
        $gen.AbilityLocked=$type -eq 3
        $gen.Ability=[byte]$(if($gen.AbilityLocked){3}else{1})
        $gen.GenderLocked=$true
        $gen.Gender=[byte]2
        $gen.NatureLocked=$type -eq 3
        $gen.Nature=[byte]3
        $gen.IVs=[int[]]@(31,-1,5,-1,-1,-1)
        $gen.IVsCount=[byte]2
        Start-Scenario $gen 0 0
        $rows=@(foreach($frame in 0..9) {
            Format-Pokemon ($generate.Invoke($null,$null))
            $null=$addNext.Invoke($null,@($rng,$true))
        })
        @{oras=$oras;type=$type;rows=$rows}
    }
})

$eventOt=@(foreach($oras in $false,$true) {
    foreach($pair in @(@(1,$true),@(2,$false),@(2,$true),@(3,$true))) {
        $type,$otherInfo=$pair
        $gen=[Pk3DSRNGTool.Event6]::new()
        $gen.IsORAS=$oras
        $gen.YourID=$true
        $gen.IsEgg=$true
        $gen.TSV=[uint16]3880
        $gen.PIDType=[byte]$type
        $gen.OtherInfo=$otherInfo
        $gen.Ability=[byte]0
        $gen.Gender=[byte]126
        $gen.IVs=[int[]]@(-1,-1,-1,-1,-1,-1)
        $gen.IVsCount=[byte]3
        Start-Scenario $gen 0 0
        $rows=@(foreach($frame in 0..9) {
            Format-Pokemon ($generate.Invoke($null,$null))
            $null=$addNext.Invoke($null,@($rng,$true))
        })
        @{oras=$oras;type=$type;otherInfo=$otherInfo;rows=$rows}
    }
})

$egg=@(foreach($test in @(
    @(0,0,$false,$false,$true), @(1,0,$true,$false,$true),
    @(1,1,$false,$true,$true), @(2,0,$true,$true,$true),
    @(3,0,$false,$false,$false), @(4,8,$true,$true,$true)
)) {
    $maleItem,$femaleItem,$masuda,$charm,$accept=$test
    $gen=[Pk3DSRNGTool.Egg6]::new()
    $gen.MaleItem=[byte]$maleItem
    $gen.FemaleItem=[byte]$femaleItem
    $gen.MaleIVs=[int[]]@(1,2,3,4,5,6)
    $gen.FemaleIVs=[int[]]@(21,22,23,24,25,26)
    $gen.InheritAbility=[byte]2
    $gen.Gender=[byte]126
    $gen.MMethod=$masuda
    $gen.ShinyCharm=$charm
    $gen.IsMainRNGEgg=$accept -and !$masuda -and !$charm
    $gen.ConsiderOtherTSV=$masuda -or $charm -or $accept
    $gen.OtherTSVs=[int[]]@(1920,2574,466)
    $gen.MarkItem()
    Start-Scenario $gen 0 $(if($accept){16}else{0})
    $rows=@(foreach($frame in 0..9) {
        $row=$generate.Invoke($null,$null)
        $parents=($row.InheritMaleIV | ForEach-Object { if($_ -eq $null){'-'}elseif($_){'M'}else{'F'} }) -join ''
        "$(Format-Pokemon $row) $($row.EggSeed.ToString('X16')) $parents"
        $null=$addNext.Invoke($null,@($rng,$true))
    })
    @{settings=$test;rows=$rows}
})

$eggKey=@(foreach($swap in $false,$true) {
    $gen=[Pk3DSRNGTool.Egg6]::new()
    $gen.MaleIVs=[int[]]@(1,2,3,4,5,6)
    $gen.FemaleIVs=[int[]]@(21,22,23,24,25,26)
    $gen.MaleItem=[byte]1
    $gen.FemaleItem=[byte]1
    $gen.InheritAbility=[byte]2
    $gen.Gender=[byte]126
    $gen.MMethod=$true
    $gen.ShinyCharm=$true
    $gen.MarkItem()
    Start-Scenario $gen 0 0
    $key=[uint32[]]@(0x6F08226B,0x7F5A7341)
    if($swap){[Array]::Reverse($key)}
    $rngBase=$assembly.GetType('Pk3DSRNGTool.Core.EggRNG')
    $rerolls=$rngBase.GetProperty('PID_Rerollcount',[Reflection.BindingFlags]'Instance,NonPublic')
    $generateKey=$gen.GetType().GetMethod('Generate',[Type[]]@([Nullable[uint32]],[uint32[]]))
    $rerolls.SetValue($gen,[byte]2,$null)
    $target=$generateKey.Invoke($gen,@($null,$key))
    $gen.TSV=[uint16]$target.PSV
    $gen.TRV=[byte]$target.PRV
    $rerolls.SetValue($gen,[byte]8,$null)
    $row=$generateKey.Invoke($gen,@($null,$key))
    $parents=($row.InheritMaleIV | ForEach-Object { if($_ -eq $null){'-'}elseif($_){'M'}else{'F'} }) -join ''
    @{swap=$swap;tsv=$gen.TSV;trv=$gen.TRV;row="$(Format-Pokemon $row) $([int]$row.SquareShiny) $parents $([int]$row.BE_InheritParents)"}
})

$location=$assembly.GetType('Pk3DSRNGTool.LocationTable6')
$tinyField=$assembly.GetType('Pk3DSRNGTool.Frame_Tiny').GetField('tinystate')
$spanMin=$assembly.GetType('Pk3DSRNGTool.Frame_Tiny').GetField('framemin')
$spanMax=$assembly.GetType('Pk3DSRNGTool.Frame_Tiny').GetField('framemax')
$wild=@(foreach($test in @(
    @('X','Normal',0,2,1,6,35,$false), @('OR','Normal',1,2,1,6,35,$false),
    @('OR','Normal',1,2,1,6,100,$false,'pressure'), @('AS','Normal',1,2,1,6,100,$false,'black'),
    @('OR','Normal',31,2,1,6,100,$false,'static'), @('AS','Normal',26,2,1,6,100,$false,'magnet'),
    @('Y','Normal',0,2,1,6,100,$false,'cuteM'), @('X','Normal',0,2,1,6,100,$false,'cuteF'),
    @('OR','Normal',1,2,1,6,100,$false,'white'), @('AS','Normal',1,2,1,6,100,$false,'compound'),
    @('X','Fishing',0,0,1,14,75,$false), @('Y','Fishing',0,1,6,14,75,$true),
    @('OR','Fishing',0,2,1,14,75,$false), @('AS','Fishing',0,2,6,14,75,$true),
    @('Y','Fishing',0,0,6,14,75,$false), @('X','Fishing',0,1,1,14,75,$true),
    @('AS','Fishing',0,2,1,14,75,$false), @('OR','Fishing',0,2,6,14,75,$true),
    @('X','RockSmash',0,0,1,280,100,$false), @('AS','RockSmash',0,0,1,280,100,$false),
    @('X','CaveShadow',0,0,1,78,100,$false), @('Y','Trap',0,0,1,0,100,$false),
    @('Y','RockSmash',0,0,1,280,100,$false), @('OR','RockSmash',0,0,1,280,100,$false),
    @('Y','CaveShadow',0,0,1,78,100,$false), @('X','Trap',0,0,1,0,100,$false),
    @('X','FriendSafari',0,0,1,6,13,$false), @('Y','FriendSafari',0,0,1,6,13,$true)
)) {
    $game,$method,$area,$rod,$party,$delay,$rate,$charm,$lead=$test
    $version=@('X','Y','OR','AS').IndexOf($game)
    $oras=$version -ge 2
    $family=if($oras){'ORAS'}else{'XY'}
    $table=switch($method) {
        'Normal' { if($oras){'ORASTable'} }
        'FriendSafari' { }
        'CaveShadow' {'Shadow_XY'}
        'Trap' {'Trap_XY'}
        default {"${method}_${family}"}
    }
    $kind=$assembly.GetType('Pk3DSRNGTool.EncounterType')
    if(!$kind){$kind=$assembly.GetTypes() | Where-Object Name -eq 'EncounterType'}
    $gen=[Pk3DSRNGTool.Wild6]::new()
    $gen.Wildtype=[Enum]::Parse($kind,$method)
    $gen.IsORAS=$oras
    $gen.ShinyCharm=$charm
    $gen.Synchro_Stat=[byte]3
    $gen.BlankGenderRatio=127
    $gen.EncounterRate=[byte]$rate
    $gen.PartyPKM=[byte]$party
    if($lead -eq 'pressure'){$gen.ModifiedLevel=[byte]101}
    if($lead -eq 'black'){$gen.Flute=[sbyte]1}
    if($lead -eq 'white'){$gen.Flute=[sbyte]-1}
    if($lead -eq 'static'){$gen.Static=$true}
    if($lead -eq 'magnet'){$gen.Magnet=$true}
    if($lead -eq 'cuteM'){$gen.CuteCharmGender=[byte]2}
    if($lead -eq 'cuteF'){$gen.CuteCharmGender=[byte]1}
    if($lead -eq 'compound'){$gen.CompoundEye=$true}
    $gen.SpecForm=[int[]]::new(13)
    $gen.SlotLevel=[byte[]]::new(13)
    $weights=2
    if($method -eq 'Fishing'){$weights=3;$gen._PIDroll_count=8}
    if($method -eq 'RockSmash'){$weights=4}
    if($method -eq 'FriendSafari'){
        $weights=if($charm){55}else{54}
        $gen.SpecForm=[int[]]::new(4)
        $gen.SlotLevel=[byte[]]@(30,30,30,30)
        $gen._ivcnt=2
        $gen._PIDroll_count=4
        $gen.HA=$charm
    }
    if($table){
        $place=$location.GetField($table).GetValue($null)[$area]
        if($method -eq 'Fishing'){$place=$place.GetRodArea(@(129,349,130)[$rod])}
        $species=$place.getSpecies($version,$false)
        $gen.SpecForm=[int[]](@(0)+$species)
        $gen.SlotLevel=[byte[]](@(0)+$place.Level)
    }
    $gen.Markslots()
    $gen.SlotSplitter=[Pk3DSRNGTool.Core.WildRNG]::SlotDistribution[$weights]
    $clock=[Pk3DSRNGTool.TinyTimeline]::new($state)
    $clock.Startingframe=500
    $clock.Maxframe=770
    $clock.Method=[byte]8
    $clock.Add(500,0)
    $clock.Add(500,1)
    $clock.Generate($false,$true)
    Start-Scenario $gen 502 $delay
    $rows=@(foreach($span in $clock.results){
        for($frame=$spanMin.GetValue($span)+2;$frame -le [Math]::Min($spanMax.GetValue($span),770);$frame+=2) {
            if($frame -lt 502){continue}
            $tiny=$tinyField.GetValue($span).Clone()
            $tiny.Currentframe=$frame
            $pool.GetField('tinystatus').SetValue($null,$tiny)
            [Pk3DSRNGTool.Core.RNGResult]::IsPokemon=$true
            try { $row=$generate.Invoke($null,$null) }
            catch { throw "$game $method frame ${frame}: $_" }
            if([Pk3DSRNGTool.Core.RNGResult]::IsPokemon) {
                "$frame $($row.Slot) $($row.Species) $($row.Level) $($row.Item) $(Format-Pokemon $row)"
            }
            $null=$addNext.Invoke($null,@($rng,$true))
            $null=$addNext.Invoke($null,@($rng,$true))
        }
    })
    @{settings=$test;rows=$rows}
})

$generateHorde=$pool.GetMethod('GenerateHorde6')
$hordes=@(foreach($game in 'X','AS'){
    foreach($calibrated in $false,$true) {
        $version=@('X','Y','OR','AS').IndexOf($game)
        $oras=$version -ge 2
        $family=if($oras){'ORAS'}else{'XY'}
        $place=$location.GetField("Horde_$family").GetValue($null)[0]
        $horde=if($calibrated){[Pk3DSRNGTool.Horde]::new($state,2,$oras)}else{$null}
        $slot=if($horde){$horde.Slot}else{[byte]1}
        $gen=[Pk3DSRNGTool.Wild6]::new()
        $gen.IsORAS=$oras
        $gen.Synchro_Stat=[byte]3
        $gen.BlankGenderRatio=127
        $gen.SpecForm=[int[]](@(0)+$place.getSpecies($version,[byte]$slot))
        $gen.SlotLevel=[byte[]](@(0)+@([byte]$place.Level)*5)
        $gen.Markslots()
        Start-Scenario $gen 0 0
        $pool.GetField('TinySynced').SetValue($null,$false)
        $pool.GetField('HASlot').SetValue($null,[byte]$(if($oras){3}else{0}))
        $pool.GetField('horde').SetValue($null,$horde)
        $rows=@(foreach($frame in 0..9){
            $members=@(foreach($row in $generateHorde.Invoke($null,$null)){
                "$($row.Slot) $($row.Species) $($row.Level) $($row.Item) $(Format-Pokemon $row)"
            })
            "$frame $slot "+($members -join ';')
            $null=$addNext.Invoke($null,@($rng,$true))
        })
        @{game=$game;calibrated=$calibrated;rows=$rows}
    }
})

$timelines=@(foreach($test in @(
    @(0,0,-1,$false,@(500),@(0)),
    @(0,78,31,$true,@(500,500,506,512),@(0,1,3,0)),
    @(1,100,32,$true,@(500,506,512,520),@(0,1,4,3)),
    @(6,280,-1,$true,@(500,500),@(0,1)),
    @(8,6,-1,$true,@(500,500,506,512),@(0,1,6,3)),
    @(9,0,-1,$false,@(500),@(5)),
    @(10,324,-1,$true,@(500,506,512,520),@(7,0,1,0)),
    @(10,326,-1,$true,@(500,506,512,520),@(7,0,1,0))
)) {
    $method,$delay,$cry,$split,$frames,$calls=$test
    $clock=[Pk3DSRNGTool.TinyTimeline]::new($state)
    $clock.Startingframe=500
    $clock.Maxframe=5000
    $clock.Method=[byte]$method
    $clock.Delay=$delay
    $clock.CryFrame=$cry
    $clock.P1=2
    for($i=0;$i -lt $frames.Count;$i++){ $clock.Add($frames[$i],$calls[$i]) }
    $clock.Generate($split,$false)
    $frameType=$assembly.GetType('Pk3DSRNGTool.Frame_Tiny')
    $count=if($method -eq 6){48}else{12}
    $rows=@(foreach($span in $clock.results | Select-Object -First $count){
        @($frameType.GetProperty('Index').GetValue($span,$null),
          $frameType.GetProperty('HitIndex').GetValue($span,$null),
          $spanMin.GetValue($span),$spanMax.GetValue($span),$frameType.GetField('rand').GetValue($span),
          $frameType.GetProperty('Sync').GetValue($span,$null),
          $frameType.GetField('enctr').GetValue($span),
          $frameType.GetProperty('Status').GetValue($span,$null)) -join ' '
    })
    @{method=$method;delay=$delay;cry=$cry;split=$split;frames=$frames;calls=$calls;rows=$rows}
})

# Find a shiny Radar map with an overlap and capture its five zones in presentation order.
$radarState=[uint32[]]$state.Clone()
$radarType=$assembly.GetType('Pk3DSRNGTool.PokeRadar')
$hasShinyPatch=$radarType.GetProperty('Shiny')
$patchType=$assembly.GetType('Pk3DSRNGTool.Patch')
$patches=$radarType.GetField('patches')
$patchX=$patchType.GetProperty('X')
$patchY=$patchType.GetProperty('Y')
$hasOverlap=$false
for($i=1;$i -le 4096;$i++){
    $radarState[0]=[uint32]$i
    $radar=[Pk3DSRNGTool.PokeRadar]::new($radarState,2,40,$true)
    if(!$hasShinyPatch.GetValue($radar,$null)){continue}
    $coordinates=@(foreach($patch in $patches.GetValue($radar)){
        "$($patchX.GetValue($patch,$null)),$($patchY.GetValue($patch,$null))"
    })
    $hasOverlap=@($coordinates | Sort-Object -Unique).Count -lt $coordinates.Count
    if($hasOverlap){break}
}
if(!$hasOverlap){throw 'Shiny Radar map with overlap missing'}
$radarRows=@(foreach($test in @(@('X',0,$false),@('Y',39,$false),@('X',40,$true))){
    $game,$chain,$forceShiny=$test
    $gen=[Pk3DSRNGTool.Wild6]::new()
    $gen.Wildtype=[Enum]::Parse($kind,'PokeRadar')
    $gen.BlankGenderRatio=127
    $gen.Synchro_Stat=[byte]255
    $gen.SpecForm=[int[]]::new(13)
    $gen.SlotLevel=[byte[]]@(50)+[byte[]]::new(12)
    $gen._ivcnt=[int][Math]::Floor($chain / 20)
    $gen.IsForcedShiny6=$forceShiny
    $gen.IsShinyLocked=$chain -gt 0 -and !$forceShiny
    $gen.Markslots()
    Start-Scenario $gen 0 14
    $pool.GetField('TinySynced').SetValue($null,$false)
    $rows=@(foreach($frame in 0..9){
        Format-Pokemon ($generate.Invoke($null,$null))
        $null=$addNext.Invoke($null,@($rng,$true))
    })
    @{game=$game;chain=$chain;forceShiny=$forceShiny;rows=$rows}
})
$radarCase=@{
    words=@($radarState[3..0] | ForEach-Object { $_.ToString('X8') })
    map=@($radarType.GetProperty('Overview').GetValue($radar,$null))
    music=[string]$radarType.GetProperty('Music').GetValue($radar,$null)
    patches=@(foreach($patch in $patches.GetValue($radar)){
        "$($patchX.GetValue($patch,$null)), $($patchY.GetValue($patch,$null)) $($patchType.GetProperty('State').GetValue($patch,$null))"
    })
    encounters=$radarRows
}
@{stationary=$stationary;event=$event;eventOt=$eventOt;egg=$egg;eggKey=$eggKey;wild=$wild;hordes=$hordes;timelines=$timelines;radar=$radarCase} | ConvertTo-Json -Depth 5


