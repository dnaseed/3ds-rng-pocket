# Run with 32-bit Windows PowerShell and the 3DS RNG Tool v1.0.6 executable.
param([Parameter(Mandatory=$true)][string]$ReferenceExe,[Parameter(Mandatory=$true)][string]$DexNavSource,[switch]$DexNavPreview,[switch]$DexNavEncounters)
$ErrorActionPreference='Stop'
$exe=(Resolve-Path -LiteralPath $ReferenceExe).Path
$null=[Reflection.Assembly]::LoadFrom($exe)
$source=@'
using System;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using Pk3DSRNGTool;
using Pk3DSRNGTool.Core;
using Pk3DSRNGTool.RNG;

public static class EncounterVectors {
    static int Bit(bool flag) { return flag ? 1 : 0; }
    static string Hash(StringBuilder rows) {
        return BitConverter.ToString(SHA256.Create().ComputeHash(Encoding.ASCII.GetBytes(rows.ToString()))).Replace("-", "").ToLowerInvariant();
    }
    public static string[] Run() {
        var radar = new StringBuilder();
        var horde = new StringBuilder();
        var nav = new StringBuilder();
        int[] levels = { 0,4,5,9,10,24,25,49,50,99,100,101,199,200,201,999 };
        int[] chains = { 0,4,5,39,40,49,99 };
        for (int i=0;i<4096;i++) {
            uint[] state = { (uint)i+1,0x99aabbcc,0x55667788,0x11223344 };
            int party=i%6+1, chain=chains[i%chains.Length];
            bool boost=(i&1)!=0;
            var r=new PokeRadar(state,party,chain,boost);
            radar.AppendLine(r.Music+" "+string.Join(" ",r.patches.Select(p=>string.Join(",",p.Ring,p.X,p.Y,p.State))));
            var h=new Horde(state,party,boost);
            horde.AppendLine(string.Join(" ",h.Lead,h.Slot,h.HA,string.Join(",",h.FluteBoosts),string.Join(",",h.HeldItems)));
            DexNav.ActiveSearch=boost; DexNav.HasDexNav=(i&2)!=0; DexNav.ShinyCharm=(i&4)!=0;
            DexNav.CompoundEyes=(i&8)!=0; DexNav.SearchLevel=levels[(i/2)%levels.Length]; DexNav.ChainLength=chain;
            DexNav.EncounterType=(byte)(i%3);
            var n=new DexNav(state);
            nav.AppendLine(n.Success ? string.Join(" ",n.X,n.Y,n.Slottype,n.Slot,Bit(n.Boost),n.Lead,n.LevelBoost,n.FluteBoost,Bit(n.HA),n.Potential,Bit(n.EggMove),n.HeldItem,Bit(n.ForcedShiny)) : "-");
        }
        return new[]{Hash(radar),Hash(horde),Hash(nav)};
    }

    public static string[] Preview() {
        // After one blink call at frame 500 from state 11223344,55667788,99AABBCC,DDEEFF00.
        uint[] state = { 0x99aabbcc,0x55667788,0xe69afdcc,0xaad57f2a };
        DexNav.HasDexNav = true;
        DexNav.ShinyCharm = false;
        DexNav.CompoundEyes = false;
        DexNav.EncounterType = 0;
        DexNav.SearchLevel = 201;
        DexNav.ChainLength = 49;
        var rows = new System.Collections.Generic.List<string>();
        foreach (var active in new[] { true, false }) {
            DexNav.ActiveSearch = active;
            var nav = new DexNav(state);
            rows.Add(nav.Success ? string.Join(" ", nav.X, nav.Y, nav.Slot + 1, nav.LevelBoost,
                nav.Potential, Bit(nav.HA), Bit(nav.EggMove), Bit(nav.Boost), nav.HeldItem, Bit(nav.ForcedShiny)) : "-");
        }
        return rows.ToArray();
    }

    public static string[] Encounters() {
        // Compose the snapshot's zone generator with the executable's manual Wild6 generator.
        var pool = typeof(Wild6).Assembly.GetType("Pk3DSRNGTool.Core.RNGPool");
        const int delay = 14;
        const int tsv = 1920;
        const byte trv = 13;
        var rows = new System.Collections.Generic.List<string>();
        DexNav.HasDexNav = true;
        DexNav.ShinyCharm = true;
        DexNav.CompoundEyes = false;
        DexNav.EncounterType = 0;
        DexNav.SearchLevel = 999;
        DexNav.ChainLength = 99;
        foreach (bool active in new[] { true, false }) {
            DexNav.ActiveSearch = active;
            foreach (bool forced in new[] { false, true }) {
                var state = new uint[] { 1,0x99aabbcc,0x55667788,0x11223344 };
                DexNav nav;
                do {
                    var clock = new TinyMT(state);
                    clock.Next();
                    nav = new DexNav(clock.status);
                    if (nav.Success && nav.ForcedShiny == forced && nav.HA == forced) break;
                } while (++state[0] <= 4096);
                if (state[0] > 4096) throw new InvalidOperationException("DexNav encounter missing");
                var gen = new Wild6 {
                    IsORAS = true, SpecForm = new[] { 201, 201 }, SlotLevel = new byte[] { 0, 0 },
                    TSV = tsv, TRV = trv, Synchro_Stat = 3, ShinyCharm = true,
                    DexNavHA = nav.HA, IsForcedShiny6 = nav.ForcedShiny, _ivcnt = nav.Potential
                };
                gen.Markslots();
                var mt = new MersenneTwister(0x35b19af2);
                for (int frame=0;frame<502;frame++) mt.Next();
                pool.GetMethod("Clear").Invoke(null, null);
                pool.GetMethod("CreateBuffer").Invoke(null, new object[] { mt, 5000, true });
                pool.GetField("igenerator").SetValue(null, gen);
                pool.GetField("TinySynced").SetValue(null, nav.Sync);
                pool.GetField("Considerdelay").SetValue(null, true);
                pool.GetField("DelayTime").SetValue(null, delay);
                var row = (ResultW6)pool.GetMethod("Generate6").Invoke(null, null);
                rows.Add(string.Join(" ", Bit(active), state[0].ToString("X8"), nav.X, nav.Y,
                    nav.Slot + 1, nav.Slottype, nav.LevelBoost, nav.Potential, Bit(nav.HA),
                    Bit(nav.EggMove), nav.HeldItem, Bit(nav.ForcedShiny), row.Species, row.Forme,
                    row.PID.ToString("X8"), row.EC.ToString("X8"), string.Join(",", row.IVs),
                    row.Nature, row.Ability, row.Gender, Bit(row.Synchronize), Bit(row.Shiny), Bit(row.SquareShiny)));
            }
        }
        return rows.ToArray();
    }
}
'@
$compiler=New-Object Microsoft.CSharp.CSharpCodeProvider
$options=New-Object System.CodeDom.Compiler.CompilerParameters
$options.GenerateInMemory=$true
$null=$options.ReferencedAssemblies.Add('System.Core.dll')
$null=$options.ReferencedAssemblies.Add($exe)
# Expand two expression-bodied members for the Framework C# 5 compiler.
$dex=(Get-Content -Raw -LiteralPath $DexNavSource).Replace('bool Sync => Lead < 50;', 'bool Sync { get { return Lead < 50; } }').Replace('Rand(ulong n) => (int)((rng.Nextuint() * n) >> 32);','Rand(ulong n) { return (int)((rng.Nextuint() * n) >> 32); }')
$result=$compiler.CompileAssemblyFromSource($options,[string[]]@($source,$dex))
if($result.Errors.HasErrors){throw ($result.Errors -join [Environment]::NewLine)}
$entry=if($DexNavEncounters){'Encounters'}elseif($DexNavPreview){'Preview'}else{'Run'}
$result.CompiledAssembly.GetType('EncounterVectors').GetMethod($entry).Invoke($null,$null)
