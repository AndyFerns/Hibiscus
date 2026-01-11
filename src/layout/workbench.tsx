import { ReactNode } from "react"
import "./Workbench.css"

export function Workbench({
    top,
    left,
    right,
    bottom,
    main
}: {
    top?: ReactNode
    left?: ReactNode
    right?: ReactNode
    bottom?: ReactNode
    main: ReactNode
}) {
    return (
        <div className="workbench">
            // Top Bar rendering
            {top && <div className="workbench-top">{top}</div>}

            {left && <aside className="panel left">{left}</aside>}

            // Main Panel
            <main className="panel main">{
                main
            }</main>
            // Right Panel
            {right && <aside className="panel right">{right}</aside>}

            // Bottom Bar
            {bottom && <footer className="panel bottom">{bottom}</footer>}
        </div>
    )
}
