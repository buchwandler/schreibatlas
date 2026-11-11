{
  description = "Pinned toolchain for CTAN schulschriften browser-font derivatives";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/c56a87d8e41ce69bd2af57eb35dcc117a9dfca33";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      python = pkgs.python3.withPackages (packages: [
        packages.fonttools
        packages.pillow
      ]);
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.chromium
          pkgs.ghostscript
          pkgs.harfbuzz
          pkgs.mftrace
          pkgs.nodejs_22
          pkgs.potrace
          pkgs.t1utils
          pkgs.texlive.combined.scheme-small
          python
        ];
        T1UTILS_VERSION = pkgs.t1utils.version;
      };
    };
}
