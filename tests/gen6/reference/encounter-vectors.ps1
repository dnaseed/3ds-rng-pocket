# Run with 32-bit Windows PowerShell and the 3DS RNG Tool v1.0.6 executable.
param([Parameter(Mandatory=$true)][string]$ReferenceExe,[Parameter(Mandatory=$true)][string]$DexNavSource)
$ErrorActionPreference='Stop'
$exe=(Resolve-Path -LiteralPath $ReferenceExe).Path
$null=[Reflection.Assembly]::LoadFrom($exe)
$source=@'
using System;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using Pk3DSRNGTool;

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
$result.CompiledAssembly.GetType('EncounterVectors').GetMethod('Run').Invoke($null,$null)
