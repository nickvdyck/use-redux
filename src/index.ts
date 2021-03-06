import { createContext, useContext, useEffect, useRef, useState } from "react"
import { Action, ActionCreatorsMapObject, bindActionCreators, Dispatch, Store } from "redux"

import shallowEqual from "./shallowEqual"

const StoreContext = createContext<Store | null>(null)

/**
 * Make the Redux store available to any nested component.
 */
const Provider = StoreContext.Provider

/**
 * Returns the current redux store or throws an error when run outside a redux context
 *
 * @internal
 */
const useStore = <T>(): Store<T, Action> => {
    const store = useContext(StoreContext)
    if (!store)
        throw new Error(
            "A redux store should be provided via the useRedux Provider component. <Provider value={store} />",
        )
    return store
}

/**
 * React hook that returns dispatch function from the current redux store.
 * Component must be wrapped inside Provider function!
 *
 * @returns {Function} dispatch
 */
const useDispatch = <TDispatch = Dispatch<Action>>(): TDispatch => {
    const store = useStore()
    return (store.dispatch as any) as TDispatch
}

/**
 * React hook that returns the state from the current redux store.
 * Component must be wrapped inside Provider function!
 *
 * Prefer using useSelector!
 *
 * @returns {*} state
 */
const useRedux = <T>(): T => {
    const store = useStore<T>()

    const [currentState, setCurrentState] = useState(store.getState())
    const previousState = useRef(currentState)

    useEffect(() => {
        let didUnsubscribe = false

        const checkForUpdates = (): void => {
            if (didUnsubscribe) return

            const newState = store.getState()

            if (!shallowEqual(newState, previousState.current)) {
                setCurrentState(newState)
                previousState.current = newState
            }
        }

        checkForUpdates()
        const unsubscribe = store.subscribe(checkForUpdates)
        const unsubscribeWrapper = (): void => {
            didUnsubscribe = true
            unsubscribe()
        }

        return unsubscribeWrapper
    }, [store])

    return currentState
}

/**
 * Will subscribe the given selector function to Redux store updates.
 * This means that any time the store is updated, the selector function will be called.
 * The selector function will be called with the Redux state and must return a new object.
 *
 * Equivalent to mapStateToProps in the redux-react connect function
 *
 * @param {(state) => state} selector
 * @readonly {object}
 */
const useSelector = <T, P>(selector: (state: T) => P): P => {
    const state = useRedux<T>()

    const [derivedState, setMappedState] = useState(selector(state))
    const previousDerivedState = useRef(derivedState)

    useEffect(() => {
        const newMappedState = selector(state)

        if (!shallowEqual(newMappedState, previousDerivedState.current)) {
            setMappedState(newMappedState)
            previousDerivedState.current = newMappedState
        }
    }, [state, selector])

    return derivedState
}

const dispatchActionsMapCache = new WeakMap<
    Dispatch<Action>,
    WeakMap<ActionCreatorsMapObject, ActionCreatorsMapObject>
>()

/**
 * Binds dispatch to each action in the given actions object.
 * Returns that object which makes it easy to use object destructuring to only keep a reference to the action you need.
 * Equivalent to mapDispatchToProps in the redux-react connect function when given an object
 *
 * @param {*} actions
 * @returns {*} actions
 */
const useActionCreators = <A extends Action, M extends ActionCreatorsMapObject<A>>(actionCreators: M): M => {
    const dispatch = useDispatch()
    let boundActionCreatorsCache = dispatchActionsMapCache.get(dispatch)

    if (!boundActionCreatorsCache) {
        boundActionCreatorsCache = new WeakMap()
        dispatchActionsMapCache.set(dispatch, boundActionCreatorsCache)
    }

    const cachedActionCreator = boundActionCreatorsCache.get(actionCreators)

    if (cachedActionCreator) return cachedActionCreator as M

    const boundActionCreators = bindActionCreators(actionCreators, dispatch)

    boundActionCreatorsCache.set(actionCreators, boundActionCreators)
    return boundActionCreators
}

export { Provider, useSelector, useRedux, useDispatch, useActionCreators }
