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
            {top && <header className="workbench-top">{top}</header>}

            {left && <aside className="panel left">{left}</aside>}

            <main className="panel main">{
                main
            }</main>
            {right && <aside className="panel right">{right}</aside>}

            {bottom && <footer className="panel bottom">{bottom}</footer>}
        </div>
    )
}
